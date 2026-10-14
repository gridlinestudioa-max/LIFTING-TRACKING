// Cardio training plans: running, biking, swimming and triathlon. Each plan is a weekly layout of workouts
// whose distances change week by week, ending in a race (or repeating, for maintenance plans).
// Pure data and logic, no React.
//
// How the plans are built (general guidance, not a coach's prescription):
// - Three sessions a week for single sports: one easy, one harder (tempo or intervals), one long.
//   Marathon and triathlon plans add sessions.
// - The long session grows about 10% a week, with an easier week every third or fourth week.
// - The last one or two weeks taper (less distance) so you're fresh on race day.
// - Swim distances are meters; run and bike distances are miles.

import { HALF_EASY, HALF_LONG, HALF_TEMPO } from './config';

export type Sport = 'run' | 'bike' | 'swim';
export type PlanFamily = Sport | 'tri';
export type WorkoutKind = 'easy' | 'tempo' | 'intervals' | 'long' | 'brick' | 'race';

export const METERS_PER_MILE = 1609.344;

/** A plan as saved: which plan, and its first Monday. */
export interface CardioPlan {
  id: PlanId;
  start: string;
}

interface Slot {
  /** Monday = 0. */
  day: number;
  sport: Sport;
  kind: WorkoutKind;
  /** Distance for 0-based week w, in the sport's unit (meters for swims, miles otherwise). */
  dist: (w: number) => number;
}

export interface PlanDef {
  id: PlanId;
  family: PlanFamily;
  /** "5K", "Century (100 mi)". */
  name: string;
  /** One line for the picker. */
  blurb: string;
  /** null = repeats every week, no end. */
  weeks: number | null;
  slots: Slot[];
  /** Race day: the last week's slots on this day are replaced by the race. */
  race?: { day: number; parts: { sport: Sport; dist: number }[] };
}

/** A distance per week from a table (the last value repeats). */
const t = (...v: number[]) => (w: number) => v[Math.min(w, v.length - 1)];
const each = (v: number) => () => v;

/**
 * Build up from `start` to `peak` over the plan, ease off every fourth week, then taper.
 * `step` rounds the result (50 m for swims, 1 or 0.5 mi otherwise).
 */
function ramp(start: number, peak: number, weeks: number, step: number) {
  return (w: number) => {
    const build = weeks - 2;
    let v = start + (peak - start) * Math.min(1, w / Math.max(1, build - 1));
    if (w % 4 === 3 && w < build) v *= 0.8;
    if (w === weeks - 2) v *= 0.7;
    if (w === weeks - 1) v *= 0.5;
    return Math.max(step, Math.round(v / step) * step);
  };
}

const MON = 0, TUE = 1, WED = 2, THU = 3, FRI = 4, SAT = 5, SUN = 6;

export const PLANS: PlanDef[] = [
  // ---------- Running ----------
  {
    id: 'run-maint', family: 'run', name: 'Maintenance', weeks: null,
    blurb: 'Keep your running fitness: 3 runs a week, about 11 miles. No end date.',
    slots: [
      { day: TUE, sport: 'run', kind: 'easy', dist: each(3) },
      { day: THU, sport: 'run', kind: 'tempo', dist: each(3) },
      { day: SUN, sport: 'run', kind: 'long', dist: each(5) },
    ],
  },
  {
    id: 'run-5k', family: 'run', name: '5K', weeks: 8,
    blurb: '8 weeks, 3 runs a week. For new runners or a faster 5K.',
    slots: [
      { day: TUE, sport: 'run', kind: 'easy', dist: t(2, 2, 2.5, 2.5, 3, 3, 3, 2) },
      { day: THU, sport: 'run', kind: 'intervals', dist: t(1.5, 2, 2, 2.5, 2.5, 3, 2, 1.5) },
      { day: SUN, sport: 'run', kind: 'long', dist: t(2, 2.5, 3, 3, 3.5, 4, 3, 3) },
    ],
    race: { day: SUN, parts: [{ sport: 'run', dist: 3.1 }] },
  },
  {
    id: 'run-10k', family: 'run', name: '10K', weeks: 10,
    blurb: '10 weeks, 3 runs a week, long run up to 7 miles.',
    slots: [
      { day: TUE, sport: 'run', kind: 'easy', dist: t(3, 3, 3, 3.5, 3.5, 4, 4, 4, 3, 2) },
      { day: THU, sport: 'run', kind: 'tempo', dist: t(2, 2.5, 3, 3, 3.5, 3.5, 4, 4, 3, 2) },
      { day: SUN, sport: 'run', kind: 'long', dist: t(3, 4, 4, 5, 5, 6, 6, 7, 5, 6.2) },
    ],
    race: { day: SUN, parts: [{ sport: 'run', dist: 6.2 }] },
  },
  {
    id: 'run-half', family: 'run', name: 'Half marathon', weeks: 12,
    blurb: '12 weeks: tempo Tuesday, easy Friday, long run Sunday, building to 13.1 miles.',
    slots: [
      { day: TUE, sport: 'run', kind: 'tempo', dist: (w: number) => HALF_TEMPO(w) },
      { day: FRI, sport: 'run', kind: 'easy', dist: (w: number) => HALF_EASY(w) },
      { day: SUN, sport: 'run', kind: 'long', dist: (w: number) => HALF_LONG[w] },
    ],
    race: { day: SUN, parts: [{ sport: 'run', dist: 13.1 }] },
  },
  {
    id: 'run-full', family: 'run', name: 'Marathon', weeks: 16,
    blurb: '16 weeks, 4 runs a week, long run up to 20 miles. Best after a half marathon.',
    slots: [
      { day: TUE, sport: 'run', kind: 'easy', dist: t(4, 4, 5, 4, 5, 5, 6, 5, 6, 6, 6, 5, 6, 5, 4, 3) },
      { day: WED, sport: 'run', kind: 'tempo', dist: t(4, 4, 5, 4, 5, 6, 6, 5, 6, 7, 7, 5, 7, 5, 4, 3) },
      { day: FRI, sport: 'run', kind: 'easy', dist: t(3, 3, 4, 3, 4, 4, 4, 4, 5, 5, 5, 4, 5, 4, 3, 2) },
      { day: SUN, sport: 'run', kind: 'long', dist: t(8, 9, 10, 8, 12, 13, 14, 10, 16, 17, 18, 12, 20, 14, 10, 26.2) },
    ],
    race: { day: SUN, parts: [{ sport: 'run', dist: 26.2 }] },
  },

  // ---------- Biking ----------
  {
    id: 'bike-maint', family: 'bike', name: 'Maintenance', weeks: null,
    blurb: 'Keep your riding fitness: 3 rides a week, about 42 miles. No end date.',
    slots: [
      { day: TUE, sport: 'bike', kind: 'easy', dist: each(10) },
      { day: THU, sport: 'bike', kind: 'intervals', dist: each(12) },
      { day: SAT, sport: 'bike', kind: 'long', dist: each(20) },
    ],
  },
  {
    id: 'bike-10', family: 'bike', name: '10 miles', weeks: 6,
    blurb: '6 weeks, 3 rides a week. A first 10-mile ride.',
    slots: [
      { day: TUE, sport: 'bike', kind: 'easy', dist: t(4, 4, 5, 5, 6, 4) },
      { day: THU, sport: 'bike', kind: 'intervals', dist: t(4, 5, 5, 6, 6, 3) },
      { day: SAT, sport: 'bike', kind: 'long', dist: t(5, 6, 7, 8, 9, 10) },
    ],
    race: { day: SAT, parts: [{ sport: 'bike', dist: 10 }] },
  },
  {
    id: 'bike-25', family: 'bike', name: '25 miles', weeks: 8,
    blurb: '8 weeks, 3 rides a week, long ride up to 20 miles.',
    slots: [
      { day: TUE, sport: 'bike', kind: 'easy', dist: t(6, 7, 8, 8, 10, 10, 8, 5) },
      { day: THU, sport: 'bike', kind: 'intervals', dist: t(6, 7, 8, 9, 10, 10, 8, 5) },
      { day: SAT, sport: 'bike', kind: 'long', dist: t(10, 12, 14, 12, 16, 20, 15, 25) },
    ],
    race: { day: SAT, parts: [{ sport: 'bike', dist: 25 }] },
  },
  {
    id: 'bike-50', family: 'bike', name: '50 miles', weeks: 10,
    blurb: '10 weeks, 3 rides a week, long ride up to 42 miles.',
    slots: [
      { day: TUE, sport: 'bike', kind: 'easy', dist: t(10, 10, 12, 12, 12, 14, 14, 15, 12, 8) },
      { day: THU, sport: 'bike', kind: 'intervals', dist: t(10, 12, 12, 14, 12, 15, 15, 16, 12, 8) },
      { day: SAT, sport: 'bike', kind: 'long', dist: t(20, 23, 26, 22, 30, 34, 38, 42, 30, 50) },
    ],
    race: { day: SAT, parts: [{ sport: 'bike', dist: 50 }] },
  },
  {
    id: 'bike-100', family: 'bike', name: 'Century (100 miles)', weeks: 12,
    blurb: '12 weeks, 3 rides a week, long ride up to 70 miles.',
    slots: [
      { day: TUE, sport: 'bike', kind: 'easy', dist: t(12, 12, 14, 15, 14, 16, 18, 18, 15, 20, 15, 10) },
      { day: THU, sport: 'bike', kind: 'intervals', dist: t(14, 15, 16, 18, 15, 20, 20, 22, 18, 22, 15, 10) },
      { day: SAT, sport: 'bike', kind: 'long', dist: t(30, 35, 40, 34, 45, 50, 55, 60, 50, 70, 50, 100) },
    ],
    race: { day: SAT, parts: [{ sport: 'bike', dist: 100 }] },
  },

  // ---------- Swimming (meters) ----------
  {
    id: 'swim-maint', family: 'swim', name: 'Maintenance', weeks: null,
    blurb: 'Keep your swim fitness: 3 swims a week, about 3,700 m. No end date.',
    slots: [
      { day: MON, sport: 'swim', kind: 'easy', dist: each(1000) },
      { day: WED, sport: 'swim', kind: 'intervals', dist: each(1200) },
      { day: SAT, sport: 'swim', kind: 'long', dist: each(1500) },
    ],
  },
  {
    id: 'swim-200', family: 'swim', name: '200 m', weeks: 6,
    blurb: '6 weeks, 3 swims a week. A first non-stop 200 m.',
    slots: [
      { day: MON, sport: 'swim', kind: 'easy', dist: t(100, 150, 150, 200, 200, 100) },
      { day: WED, sport: 'swim', kind: 'intervals', dist: t(100, 100, 150, 150, 200, 100) },
      { day: SAT, sport: 'swim', kind: 'long', dist: t(100, 150, 150, 200, 250, 200) },
    ],
    race: { day: SAT, parts: [{ sport: 'swim', dist: 200 }] },
  },
  {
    id: 'swim-400', family: 'swim', name: '400 m', weeks: 6,
    blurb: '6 weeks, 3 swims a week, building to 400 m non-stop.',
    slots: [
      { day: MON, sport: 'swim', kind: 'easy', dist: t(200, 200, 250, 300, 300, 200) },
      { day: WED, sport: 'swim', kind: 'intervals', dist: t(150, 200, 250, 250, 300, 150) },
      { day: SAT, sport: 'swim', kind: 'long', dist: t(200, 250, 300, 350, 450, 400) },
    ],
    race: { day: SAT, parts: [{ sport: 'swim', dist: 400 }] },
  },
  {
    id: 'swim-800', family: 'swim', name: '800 m', weeks: 8,
    blurb: '8 weeks, 3 swims a week, long swim up to 900 m.',
    slots: [
      { day: MON, sport: 'swim', kind: 'easy', dist: t(300, 400, 400, 500, 400, 500, 600, 300) },
      { day: WED, sport: 'swim', kind: 'intervals', dist: t(300, 300, 400, 400, 400, 500, 500, 300) },
      { day: SAT, sport: 'swim', kind: 'long', dist: t(400, 500, 600, 500, 700, 800, 900, 800) },
    ],
    race: { day: SAT, parts: [{ sport: 'swim', dist: 800 }] },
  },
  {
    id: 'swim-1500', family: 'swim', name: '1500 m', weeks: 10,
    blurb: '10 weeks, 3 swims a week, long swim up to 1,800 m.',
    slots: [
      { day: MON, sport: 'swim', kind: 'easy', dist: t(600, 700, 800, 700, 800, 900, 1000, 1000, 800, 500) },
      { day: WED, sport: 'swim', kind: 'intervals', dist: t(500, 600, 700, 600, 800, 900, 1000, 1000, 800, 400) },
      { day: SAT, sport: 'swim', kind: 'long', dist: t(800, 1000, 1100, 1000, 1200, 1400, 1600, 1800, 1400, 1500) },
    ],
    race: { day: SAT, parts: [{ sport: 'swim', dist: 1500 }] },
  },

  // ---------- Triathlon ----------
  {
    id: 'tri-sprint', family: 'tri', name: 'Sprint', weeks: 10,
    blurb: '750 m swim, 12.4 mi bike, 3.1 mi run. 10 weeks, 6 days a week.',
    slots: [
      { day: TUE, sport: 'swim', kind: 'intervals', dist: ramp(400, 800, 10, 50) },
      { day: WED, sport: 'run', kind: 'tempo', dist: ramp(2, 3, 10, 0.5) },
      { day: THU, sport: 'bike', kind: 'intervals', dist: ramp(6, 12, 10, 1) },
      { day: FRI, sport: 'swim', kind: 'easy', dist: ramp(400, 700, 10, 50) },
      { day: SAT, sport: 'bike', kind: 'brick', dist: ramp(8, 15, 10, 1) },
      { day: SAT, sport: 'run', kind: 'brick', dist: ramp(1, 2, 10, 0.5) },
      { day: SUN, sport: 'run', kind: 'long', dist: ramp(2.5, 4, 10, 0.5) },
    ],
    race: { day: SUN, parts: [{ sport: 'swim', dist: 750 }, { sport: 'bike', dist: 12.4 }, { sport: 'run', dist: 3.1 }] },
  },
  {
    id: 'tri-standard', family: 'tri', name: 'Standard (Olympic)', weeks: 12,
    blurb: '1,500 m swim, 24.8 mi bike, 6.2 mi run. 12 weeks, 6 days a week.',
    slots: [
      { day: TUE, sport: 'swim', kind: 'intervals', dist: ramp(800, 1600, 12, 50) },
      { day: WED, sport: 'run', kind: 'tempo', dist: ramp(3, 5, 12, 0.5) },
      { day: THU, sport: 'bike', kind: 'intervals', dist: ramp(10, 18, 12, 1) },
      { day: FRI, sport: 'swim', kind: 'easy', dist: ramp(800, 1400, 12, 50) },
      { day: SAT, sport: 'bike', kind: 'brick', dist: ramp(15, 30, 12, 1) },
      { day: SAT, sport: 'run', kind: 'brick', dist: ramp(1.5, 3, 12, 0.5) },
      { day: SUN, sport: 'run', kind: 'long', dist: ramp(4, 7, 12, 0.5) },
    ],
    race: { day: SUN, parts: [{ sport: 'swim', dist: 1500 }, { sport: 'bike', dist: 24.8 }, { sport: 'run', dist: 6.2 }] },
  },
  {
    id: 'tri-half', family: 'tri', name: 'Half Ironman (70.3)', weeks: 16,
    blurb: '1.2 mi swim, 56 mi bike, 13.1 mi run. 16 weeks, 6 days a week.',
    slots: [
      { day: MON, sport: 'swim', kind: 'easy', dist: ramp(1200, 2000, 16, 50) },
      { day: TUE, sport: 'bike', kind: 'intervals', dist: ramp(15, 25, 16, 1) },
      { day: WED, sport: 'run', kind: 'tempo', dist: ramp(4, 6, 16, 0.5) },
      { day: THU, sport: 'swim', kind: 'intervals', dist: ramp(1500, 2500, 16, 50) },
      { day: SAT, sport: 'bike', kind: 'brick', dist: ramp(25, 60, 16, 1) },
      { day: SAT, sport: 'run', kind: 'brick', dist: ramp(2, 4, 16, 0.5) },
      { day: SUN, sport: 'run', kind: 'long', dist: ramp(6, 12, 16, 0.5) },
    ],
    race: { day: SUN, parts: [{ sport: 'swim', dist: 1900 }, { sport: 'bike', dist: 56 }, { sport: 'run', dist: 13.1 }] },
  },
  {
    id: 'tri-full', family: 'tri', name: 'Full Ironman (140.6)', weeks: 24,
    blurb: '2.4 mi swim, 112 mi bike, 26.2 mi run. 24 weeks, 6 days a week. Best after a 70.3.',
    slots: [
      { day: MON, sport: 'swim', kind: 'easy', dist: ramp(1500, 3000, 24, 50) },
      { day: TUE, sport: 'bike', kind: 'intervals', dist: ramp(20, 35, 24, 1) },
      { day: WED, sport: 'run', kind: 'tempo', dist: ramp(5, 8, 24, 0.5) },
      { day: THU, sport: 'swim', kind: 'intervals', dist: ramp(2000, 4000, 24, 50) },
      { day: SAT, sport: 'bike', kind: 'brick', dist: ramp(40, 100, 24, 1) },
      { day: SAT, sport: 'run', kind: 'brick', dist: ramp(2, 4, 24, 0.5) },
      { day: SUN, sport: 'run', kind: 'long', dist: ramp(8, 20, 24, 0.5) },
    ],
    race: { day: SUN, parts: [{ sport: 'swim', dist: 3800 }, { sport: 'bike', dist: 112 }, { sport: 'run', dist: 26.2 }] },
  },
];

/** A plan's id, e.g. "run-half". */
export type PlanId = string;

export const PLAN_BY_ID: Record<PlanId, PlanDef> = Object.fromEntries(PLANS.map((p) => [p.id, p]));

export const PLAN_FAMILIES: { id: PlanFamily; label: string }[] = [
  { id: 'run', label: 'Running' },
  { id: 'bike', label: 'Biking' },
  { id: 'swim', label: 'Swimming' },
  { id: 'tri', label: 'Triathlon' },
];

export const plansFor = (f: PlanFamily): PlanDef[] => PLANS.filter((p) => p.family === f);

export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && Object.hasOwn(PLAN_BY_ID, v);

/** "Half marathon", "Triathlon: Sprint", "Running: maintenance". */
export function planTitle(id: PlanId): string {
  const p = PLAN_BY_ID[id];
  const fam = PLAN_FAMILIES.find((f) => f.id === p.family)!.label;
  if (p.weeks == null) return `${fam}: maintenance`;
  if (p.family === 'tri') return `${p.name} triathlon`;
  if (p.family === 'run') return p.name;
  return `${fam}: ${p.name}`;
}

/** Plan distances are meters for swims and miles otherwise; the app stores miles. */
export const toMiles = (sport: Sport, d: number) => (sport === 'swim' ? d / METERS_PER_MILE : d);
