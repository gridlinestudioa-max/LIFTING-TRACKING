// Diets: preloaded presets plus user-adjusted limits, and the rules that say whether a day's food is on track.
// A diet is two independent parts that can be combined, e.g. 16:8 fasting + keto:
//   - an eating window (intermittent fasting), and
//   - a food style: numeric limits (net carbs, protein, ...) and/or food groups to avoid.

import type { Tone } from './calories';
import { activeCycle, type Cycle } from './cycle';
import { fmt, fmtInt } from './format';
import { statsOf, suggestTargets, type Profile } from './profile';
import { TAG_LABEL, byTime, entryTotals, fatPct, fmtClock, fmtDuration, sumTotals, type FoodEntry, type FoodTag, type Totals } from './nutrition';

/** Food and drink under this many calories (black coffee, tea, water) don't break a fast. */
export const FAST_SAFE_KCAL = 10;

export interface Fasting {
  /** Hours in the eating window (8 for 16:8). */
  eatHours: number;
  /** When the window opens, minutes after midnight. */
  start: number;
}

export interface Limits {
  kcalMax?: number;
  netCarbsMax?: number;
  sugarMax?: number;
  proteinMin?: number;
  /** Max share of calories from fat, percent. */
  fatPctMax?: number;
}

export type StyleId =
  | 'none'
  | 'keto'
  | 'lowcarb'
  | 'highprotein'
  | 'lowfat'
  | 'vegetarian'
  | 'pescatarian'
  | 'vegan'
  | 'paleo'
  | 'custom';

export interface DietSettings {
  fasting: Fasting | null;
  style: StyleId;
  /**
   * Use the targets suggested from the profile and food style (the default). Off: `limits` are the
   * user's own numbers. Without a profile, `limits` (the style's preset) are used either way.
   */
  auto: boolean;
  /** The user's own limits, or the style's preset. See `activeDiet` for what's in force. */
  limits: Limits;
  /** Food groups to avoid. */
  exclude: FoodTag[];
}

export const DEFAULT_DIET: DietSettings = { fasting: null, style: 'none', auto: true, limits: {}, exclude: [] };

export const FAST_PRESETS: { id: string; eatHours: number; blurb: string }[] = [
  { id: '14:10', eatHours: 10, blurb: '14 h fast, 10 h to eat. A gentle start.' },
  { id: '16:8', eatHours: 8, blurb: '16 h fast, 8 h to eat. The most common schedule.' },
  { id: '18:6', eatHours: 6, blurb: '18 h fast, 6 h to eat.' },
  { id: '20:4', eatHours: 4, blurb: '20 h fast, 4 h to eat (Warrior diet).' },
  { id: 'OMAD', eatHours: 1, blurb: 'One meal a day: a 1 h eating window.' },
];

/** "16:8", "OMAD", or "19:5" for a custom window. */
export function fastLabel(f: Fasting): string {
  const p = FAST_PRESETS.find((x) => x.eatHours === f.eatHours);
  return p ? p.id : `${24 - f.eatHours}:${f.eatHours}`;
}

export interface StylePreset {
  id: StyleId;
  name: string;
  blurb: string;
  limits: Limits;
  exclude: FoodTag[];
}

export const STYLES: StylePreset[] = [
  { id: 'none', name: 'No food rules', blurb: 'Just track what you eat.', limits: {}, exclude: [] },
  { id: 'keto', name: 'Keto', blurb: 'Very low carb: 20 g net carbs a day or less.', limits: { netCarbsMax: 20 }, exclude: [] },
  { id: 'lowcarb', name: 'Low carb', blurb: 'Fewer carbs: 50 to 130 g net a day.', limits: { netCarbsMax: 100 }, exclude: [] },
  { id: 'highprotein', name: 'High protein', blurb: 'Extra protein every day, for building muscle.', limits: { proteinMin: 150 }, exclude: [] },
  { id: 'lowfat', name: 'Low fat', blurb: 'No more than 25% of calories from fat.', limits: { fatPctMax: 25 }, exclude: [] },
  { id: 'vegetarian', name: 'Vegetarian', blurb: 'No meat, poultry or fish.', limits: {}, exclude: ['meat', 'fish'] },
  { id: 'pescatarian', name: 'Pescatarian', blurb: 'Fish is fine; no meat or poultry.', limits: {}, exclude: ['meat'] },
  { id: 'vegan', name: 'Vegan', blurb: 'No animal foods: meat, fish, dairy or eggs.', limits: {}, exclude: ['meat', 'fish', 'dairy', 'egg'] },
  { id: 'paleo', name: 'Paleo', blurb: 'No grains, beans, dairy or added sugar.', limits: {}, exclude: ['grain', 'legume', 'dairy', 'sugar'] },
  { id: 'custom', name: 'Custom', blurb: 'Set your own limits and foods to avoid.', limits: {}, exclude: [] },
];

export const STYLE_BY_ID: Record<StyleId, StylePreset> = Object.fromEntries(STYLES.map((s) => [s.id, s])) as Record<
  StyleId,
  StylePreset
>;

/** Switch food style: load its preset limits and foods to avoid. The calorie limit is kept. */
export function withStyle(d: DietSettings, id: StyleId): DietSettings {
  const p = STYLE_BY_ID[id];
  const limits: Limits = { ...p.limits };
  if (d.limits.kcalMax != null) limits.kcalMax = d.limits.kcalMax;
  return { ...d, style: id, limits, exclude: [...p.exclude] };
}

/** True when the limits or avoided foods differ from the chosen preset (ignoring the calorie limit). */
export function isAdjusted(d: DietSettings): boolean {
  if (d.style === 'custom') return false;
  const p = STYLE_BY_ID[d.style];
  const keys: (keyof Limits)[] = ['netCarbsMax', 'sugarMax', 'proteinMin', 'fatPctMax'];
  if (keys.some((k) => d.limits[k] !== p.limits[k])) return true;
  return [...d.exclude].sort().join() !== [...p.exclude].sort().join();
}

/** True when the diet's targets come from the profile right now. */
export function usesSuggestions(d: DietSettings, profile: Profile | null): boolean {
  return d.auto && !!statsOf(profile);
}

/**
 * The diet with the limits actually in force: suggested from the profile, or the stored ones. While a cut,
 * bulk or maintenance phase runs, its calories and protein replace the suggested ones.
 */
export function activeDiet(d: DietSettings, profile: Profile | null, cycle?: Cycle | null): DietSettings {
  if (!usesSuggestions(d, profile)) return d;
  const limits = suggestTargets(statsOf(profile)!, d.style).limits;
  return { ...d, limits: cycle ? { ...limits, kcalMax: cycle.intake, proteinMin: Math.max(limits.proteinMin ?? 0, cycle.proteinG) } : limits };
}

/** The diet in force for the app's state today, phase included. */
export function dietFor(state: { diet: DietSettings; profile: Profile | null; cycle: Cycle | null }, today: string): DietSettings {
  return activeDiet(state.diet, state.profile, activeCycle(state.cycle, today));
}

/** Switch to editing your own numbers, starting from what's in force now. */
export function editOwnLimits(d: DietSettings, profile: Profile | null): DietSettings {
  return { ...d, auto: false, limits: { ...activeDiet(d, profile).limits } };
}

/** True when the diet has any rule at all. */
export function hasRules(d: DietSettings): boolean {
  return !!d.fasting || d.exclude.length > 0 || Object.values(d.limits).some((v) => v != null);
}

/** "16:8 fasting · Keto", "Keto · your targets", or "No diet set". */
export function dietName(d: DietSettings, profile: Profile | null = null): string {
  const parts: string[] = [];
  const suggested = usesSuggestions(d, profile);
  const stats = statsOf(profile);
  if (d.fasting) parts.push(`${fastLabel(d.fasting)} fasting`);
  if (d.style !== 'none') parts.push(STYLE_BY_ID[d.style].name + (!suggested && stats == null && isAdjusted(d) ? ' (adjusted)' : ''));
  if (suggested) parts.push('suggested targets');
  else if (stats && hasRules({ ...d, fasting: null, exclude: [] })) parts.push('your own targets');
  else if (d.style === 'none' && hasRules({ ...d, fasting: null })) parts.push('Custom limits');
  return parts.length ? parts.join(' · ') : 'No diet set';
}

// ---------- Eating window ----------

/** Minutes since the window opened, 0..1439. */
function sinceOpen(f: Fasting, min: number): number {
  return (((min - f.start) % 1440) + 1440) % 1440;
}

export function inWindow(f: Fasting, min: number): boolean {
  return sinceOpen(f, min) < f.eatHours * 60;
}

/** "12:00 PM – 8:00 PM" */
export function windowText(f: Fasting): string {
  return `${fmtClock(f.start)} – ${fmtClock(f.start + f.eatHours * 60)}`;
}

const two = (n: number) => String(n).padStart(2, '0');

/** "12:00–20:00": the eating window in 24-hour time. */
export function window24(f: Fasting): string {
  const t = (m: number) => {
    const x = ((Math.round(m) % 1440) + 1440) % 1440;
    return `${two(Math.floor(x / 60))}:${two(x % 60)}`;
  };
  return `${t(f.start)}–${t(f.start + f.eatHours * 60)}`;
}

/** A countdown, "3:42:15" (hours:minutes:seconds). */
export function countdown(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 3600)}:${two(Math.floor((s % 3600) / 60))}:${two(s % 60)}`;
}

/** Seconds until the window next closes (while open) or opens (while fasting), at `secOfDay` seconds after midnight. */
export function fastSecondsLeft(f: Fasting, secOfDay: number): { open: boolean; secs: number } {
  const s = fastState(f, Math.floor(secOfDay / 60));
  return { open: s.open, secs: Math.max(0, s.minsUntil * 60 - (secOfDay % 60)) };
}

export interface FastState {
  /** Inside the eating window right now. */
  open: boolean;
  /** When it next opens (if closed) or closes (if open), minutes after midnight. */
  changeAt: number;
  /** Minutes until then. */
  minsUntil: number;
}

export function fastState(f: Fasting, nowMin: number): FastState {
  const since = sinceOpen(f, nowMin);
  const len = f.eatHours * 60;
  const open = since < len;
  return open
    ? { open, changeAt: (f.start + len) % 1440, minsUntil: len - since }
    : { open, changeAt: f.start, minsUntil: 1440 - since };
}

/** Food that counts as eating (breaks a fast). */
export function breaksFast(e: FoodEntry): boolean {
  return entryTotals(e).kcal >= FAST_SAFE_KCAL;
}

/**
 * Minutes since the last food that broke a fast, looking at today (up to now) and yesterday.
 * Null if nothing was eaten in that time.
 */
export function minsSinceLastMeal(today: FoodEntry[], yesterday: FoodEntry[], nowMin: number): number | null {
  const t = today.filter((e) => breaksFast(e) && e.at <= nowMin).map((e) => e.at);
  if (t.length) return nowMin - Math.max(...t);
  const y = yesterday.filter(breaksFast).map((e) => e.at);
  if (y.length) return nowMin + 1440 - Math.max(...y);
  return null;
}

/** One-line headline for the eating window right now. */
export function fastHeadline(f: Fasting, nowMin: number): { title: string; detail: string; open: boolean } {
  const s = fastState(f, nowMin);
  return s.open
    ? { open: true, title: 'You can eat now', detail: `Eating window closes at ${fmtClock(s.changeAt)} (${fmtDuration(s.minsUntil)} left)` }
    : { open: false, title: 'Fasting: don’t eat yet', detail: `Eating window opens at ${fmtClock(s.changeAt)} (in ${fmtDuration(s.minsUntil)})` };
}

// ---------- Checking a day ----------

export type Verdict = 'none' | 'on' | 'close' | 'off';

export interface Check {
  key: string;
  label: string;
  value: string;
  tone: Tone;
  /** Short reason or what's left, e.g. "12 g left". */
  note?: string;
}

export interface DayEval {
  verdict: Verdict;
  totals: Totals;
  checks: Check[];
  /** Why each off-track food is off track, by entry id. */
  flags: Record<string, string[]>;
}

/** Within this share of a max limit counts as "close". */
const CLOSE = 0.9;

interface MaxRule {
  key: 'kcalMax' | 'netCarbsMax' | 'sugarMax';
  total: keyof Totals;
  label: string;
  unit: string;
}

const MAX_RULES: MaxRule[] = [
  { key: 'kcalMax', total: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'netCarbsMax', total: 'netCarbs', label: 'Net carbs', unit: 'g' },
  { key: 'sugarMax', total: 'sugar', label: 'Sugar', unit: 'g' },
];

const amount = (v: number, unit: string) => (unit === 'kcal' ? `${fmtInt(v)} kcal` : `${fmt(Math.round(v * 10) / 10)} g`);

/**
 * Check a day's food against the diet.
 * `finished`: the day is over, so a minimum not reached (protein) counts as missed instead of "to go".
 * `extraKcal`: calories typed on the day outside the food log. They count toward the calorie limit only.
 */
export function evaluateDay(d: DietSettings, entries: readonly FoodEntry[], finished: boolean, extraKcal = 0): DayEval {
  const sorted = byTime(entries);
  const totals = sumTotals(sorted);
  const checks: Check[] = [];
  const flags: Record<string, string[]> = {};
  const flag = (id: string, why: string) => (flags[id] ??= []).push(why);
  const any = sorted.length > 0 || extraKcal > 0;

  if (d.fasting) {
    const f = d.fasting;
    const outside = sorted.filter((e) => breaksFast(e) && !inWindow(f, e.at));
    outside.forEach((e) => flag(e.id, `Eaten at ${fmtClock(e.at)}, outside your eating window`));
    checks.push({
      key: 'window',
      label: `${fastLabel(f)} eating window`,
      value: windowText(f),
      tone: !any ? 'mute' : outside.length ? 'bad' : 'ok',
      note: outside.length ? `${outside.length} ${outside.length === 1 ? 'food' : 'foods'} outside the window` : any ? 'All food inside the window' : undefined,
    });
  }

  for (const r of MAX_RULES) {
    const max = d.limits[r.key];
    if (max == null) continue;
    const extra = r.total === 'kcal' ? extraKcal : 0;
    const v = totals[r.total] + extra;
    // Flag the food that took the day over the limit, and everything after it.
    let run = extra;
    for (const e of sorted) {
      run += entryTotals(e)[r.total];
      if (run > max + 1e-9) flag(e.id, `Over your ${r.label.toLowerCase()} limit`);
    }
    checks.push({
      key: r.key,
      label: r.label,
      value: `${amount(v, r.unit)} / ${amount(max, r.unit)}`,
      tone: v > max + 1e-9 ? 'bad' : v >= max * CLOSE && v > 0 ? 'warn' : any ? 'ok' : 'mute',
      note: v > max + 1e-9 ? `${amount(v - max, r.unit)} over` : `${amount(max - v, r.unit)} left`,
    });
  }

  if (d.limits.proteinMin != null) {
    const min = d.limits.proteinMin;
    const v = totals.protein;
    const met = v >= min;
    checks.push({
      key: 'proteinMin',
      label: 'Protein',
      value: `${amount(v, 'g')} / ${amount(min, 'g')}`,
      tone: met ? 'ok' : finished ? 'bad' : 'mute',
      note: met ? 'Target reached' : `${amount(min - v, 'g')} to go`,
    });
  }

  if (d.limits.fatPctMax != null) {
    const max = d.limits.fatPctMax;
    const p = fatPct(totals);
    checks.push({
      key: 'fatPctMax',
      label: 'Calories from fat',
      value: p == null ? `– / ${max}%` : `${Math.round(p)}% / ${max}%`,
      tone: p == null ? 'mute' : p > max ? 'bad' : p >= max * CLOSE ? 'warn' : 'ok',
    });
  }

  if (d.exclude.length) {
    const bad = sorted.filter((e) => e.tags.some((t) => d.exclude.includes(t)));
    bad.forEach((e) => {
      const hit = e.tags.filter((t) => d.exclude.includes(t)).map((t) => TAG_LABEL[t].toLowerCase());
      flag(e.id, `Has ${hit.join(', ')}`);
    });
    checks.push({
      key: 'exclude',
      label: 'Foods to avoid',
      value: d.exclude.map((t) => TAG_LABEL[t]).join(', '),
      tone: !any ? 'mute' : bad.length ? 'bad' : 'ok',
      note: bad.length ? bad.map((e) => e.name).join(', ') : any ? 'None eaten' : undefined,
    });
  }

  const tones = checks.map((c) => c.tone);
  const verdict: Verdict =
    !any || !checks.length ? 'none' : tones.includes('bad') ? 'off' : tones.includes('warn') ? 'close' : 'on';
  return { verdict, totals, checks, flags };
}

export interface Preview {
  tone: 'ok' | 'warn' | 'bad';
  lines: string[];
}

/**
 * What adding one more food would do to the day, shown before it's added.
 * Null when the diet has no rules.
 */
export function previewEntry(
  d: DietSettings,
  entries: readonly FoodEntry[],
  e: FoodEntry,
  nowMin: number | null,
  extraKcal = 0,
): Preview | null {
  if (!hasRules(d)) return null;
  const withExtra = (t: Totals): Totals => ({ ...t, kcal: t.kcal + extraKcal });
  const before = withExtra(sumTotals(entries));
  const after = withExtra(sumTotals([...entries, e]));
  const t = entryTotals(e);
  const bad: string[] = [];
  const warn: string[] = [];
  const ok: string[] = [];

  if (d.fasting && breaksFast(e) && !inWindow(d.fasting, e.at)) {
    const opens = fmtClock(d.fasting.start);
    bad.push(
      nowMin != null && e.at === nowMin
        ? `You’re fasting right now. Your eating window opens at ${opens}.`
        : `${fmtClock(e.at)} is outside your eating window (${windowText(d.fasting)}).`,
    );
  } else if (d.fasting && !breaksFast(e)) {
    ok.push('Under 10 kcal, so it won’t break a fast.');
  }

  const hit = e.tags.filter((g) => d.exclude.includes(g));
  if (hit.length) bad.push(`Has ${hit.map((g) => TAG_LABEL[g].toLowerCase()).join(', ')}, which your diet avoids.`);

  for (const r of MAX_RULES) {
    const max = d.limits[r.key];
    if (max == null || t[r.total] <= 0) continue;
    const a = after[r.total];
    const name = r.label.toLowerCase();
    if (a > max + 1e-9) {
      bad.push(
        before[r.total] > max + 1e-9
          ? `You’re already over your ${name} limit. This adds ${amount(t[r.total], r.unit)}.`
          : `Puts you over your ${name} limit: ${amount(a, r.unit)} of ${amount(max, r.unit)}.`,
      );
    } else if (a >= max * CLOSE) {
      warn.push(`Close to your ${name} limit: ${amount(a, r.unit)} of ${amount(max, r.unit)}.`);
    } else {
      ok.push(`${amount(max - a, r.unit)} ${name} left after this.`);
    }
  }

  if (d.limits.fatPctMax != null) {
    const p = fatPct(after);
    if (p != null && p > d.limits.fatPctMax) {
      const tp = fatPct(t);
      if (tp != null && tp > d.limits.fatPctMax) warn.push(`${Math.round(tp)}% of this food’s calories are fat (limit ${d.limits.fatPctMax}%).`);
    }
  }

  if (d.limits.proteinMin != null && t.protein > 0) {
    const left = d.limits.proteinMin - after.protein;
    ok.push(left > 0 ? `${amount(left, 'g')} protein to go after this.` : 'Protein target reached with this.');
  }

  if (bad.length) return { tone: 'bad', lines: [...bad, ...warn] };
  if (warn.length) return { tone: 'warn', lines: warn };
  return { tone: 'ok', lines: ['Fits your diet.', ...ok] };
}

/** Accepts anything (parsed JSON) and returns valid diet settings. */
export function normalizeDiet(src: unknown): DietSettings {
  if (!src || typeof src !== 'object') return { ...DEFAULT_DIET, limits: {}, exclude: [] };
  const s = src as Record<string, any>;
  const style: StyleId = typeof s.style === 'string' && s.style in STYLE_BY_ID ? (s.style as StyleId) : 'none';
  let fasting: Fasting | null = null;
  if (s.fasting && typeof s.fasting === 'object') {
    const eh = Number(s.fasting.eatHours);
    const st = Number(s.fasting.start);
    if (eh >= 1 && eh <= 23 && st >= 0 && st < 1440) fasting = { eatHours: Math.round(eh), start: Math.round(st) };
  }
  const limits: Limits = {};
  if (s.limits && typeof s.limits === 'object') {
    (['kcalMax', 'netCarbsMax', 'sugarMax', 'proteinMin', 'fatPctMax'] as const).forEach((k) => {
      const v = s.limits[k];
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) limits[k] = v;
    });
  }
  const exclude = Array.isArray(s.exclude) ? (s.exclude.filter((t: unknown) => typeof t === 'string' && t in TAG_LABEL) as FoodTag[]) : [];
  // Diets saved before suggestions existed keep the numbers they had.
  const auto = s.auto === true;
  return { fasting, style, auto, limits, exclude };
}
