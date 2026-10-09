import { LIFTS, TYPES, type DayType, type LiftGroup } from './config';
import { planWithSwap, targetFor, type PlanDay } from './plan';
import { fmtTime, parseTime } from './time';
import type { DayLog, TrackerState } from './types';

/** Raw text the user is editing for one day. Drafts live in memory only. */
export interface DayForm {
  lifts: Record<string, { w: string; done: boolean }>;
  miles: string;
  time: string;
  cin: string;
  cout: string;
  note: string;
  /** Workout skipped (lift/run days). Hides the workout fields; calories still allowed. */
  skipped: boolean;
  /** Workout type done instead of the scheduled one ('' = as scheduled). */
  swap: DayType | '';
  /** Rest day: skipped day being made up ('' = none). */
  makeupFor: string;
}

/** The plan the form is logging against (any day may have a different workout swapped in). */
export function formPlan(state: TrackerState, base: PlanDay, f: DayForm): PlanDay {
  return planWithSwap(state, base, f.swap, f.makeupFor);
}

/** Build the editable form from a saved log (or empty), prefilling lift targets. */
export function formFromLog(state: TrackerState, base: PlanDay, log: DayLog | undefined): DayForm {
  const l = log ?? {};
  const plan = planWithSwap(state, base, l.swap, l.makeupFor);
  const lifts: DayForm['lifts'] = {};
  if (TYPES[plan.type].kind === 'lift') {
    LIFTS[plan.type as LiftGroup].forEach((e) => {
      const rec = l.lifts?.[e.id];
      const w = rec?.w != null ? rec.w : targetFor(state.base, e.id, plan.w);
      lifts[e.id] = { w: String(w), done: !!rec?.done };
    });
  }
  return {
    lifts,
    miles: l.miles != null ? String(l.miles) : '',
    time: l.secs! > 0 ? fmtTime(l.secs!) : '',
    cin: l.cin != null ? String(l.cin) : '',
    cout: l.cout != null ? String(l.cout) : '',
    note: l.note ?? '',
    skipped: !!l.skipped,
    swap: l.swap ?? '',
    makeupFor: l.makeupFor ?? '',
  };
}

/** Parse a non-negative number field; null when empty/invalid. */
export function num(v: string): number | null {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Convert the form to a log (not yet marked submitted). */
export function logFromForm(state: TrackerState, base: PlanDay, f: DayForm): DayLog {
  const plan = formPlan(state, base, f);
  const kind = TYPES[plan.type].kind;
  const out: DayLog = {};
  if (plan.swapped) {
    out.swap = plan.type;
    if (plan.makeupFor) out.makeupFor = plan.makeupFor;
  }
  if (kind !== 'rest' && !plan.swapped && f.skipped) {
    out.skipped = true;
  } else if (kind === 'lift') {
    out.lifts = {};
    LIFTS[plan.type as LiftGroup].forEach((e) => {
      const r = f.lifts[e.id] ?? { w: '', done: false };
      const w = parseFloat(r.w);
      out.lifts![e.id] = { w: Number.isFinite(w) ? w : targetFor(state.base, e.id, plan.w), done: r.done };
    });
  } else if (kind === 'run') {
    const mi = parseFloat(f.miles);
    const secs = parseTime(f.time);
    if (Number.isFinite(mi) && mi > 0) out.miles = mi;
    if (secs != null && secs > 0) out.secs = secs;
  }
  const ci = num(f.cin);
  const co = num(f.cout);
  if (ci != null) out.cin = ci;
  if (co != null) out.cout = co;
  if (f.note) out.note = f.note;
  return out;
}

/**
 * Validation: run day needs miles or calories; rest day needs calories;
 * lift day can be submitted with anything. Returns an error message or null.
 */
export function submitError(base: PlanDay, log: DayLog): string | null {
  const kind = TYPES[log.swap ?? base.type].kind;
  const hasK = log.cin != null || log.cout != null;
  if (log.skipped) return null; // a skip can be saved on its own
  if (kind === 'run' && !(log.miles! > 0) && !hasK) return 'Enter your miles or calories first.';
  if (kind === 'rest' && !hasK) return 'Enter your calories first.';
  return null;
}

/** Reformat a time field on blur ("58" -> "58:00"). */
export function normalizeTimeInput(v: string): string {
  const secs = parseTime(v);
  return secs != null && secs > 0 ? fmtTime(secs) : v;
}
