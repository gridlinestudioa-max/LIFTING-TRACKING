// Constants for the 12-week half-marathon plan (Cardio tab) and storage.

export const PLAN_WEEKS = 12;
export const PLAN_DAYS = PLAN_WEEKS * 7; // 84

/** Saved data on the device, before accounts (read once to bring it into the new format). */
export const STORAGE_KEY_V1 = 'mm_tracker_v1';
/** Saved data on the device, per account ("local" when used without an account). */
export const storageKey = (user: string) => `mm_tracker_v2:${user}`;

/** Long run miles for weeks 1..12. Week 12 Sunday is race day. */
export const LONG: readonly number[] = [7, 8, 9, 7, 10, 11, 8, 12, 10, 8, 6, 13.1];

/** Easy run miles for week index w (0-based). */
export function easyMiles(w: number): number {
  return w === 11 ? 2 : 3;
}

/** Tempo run miles for week index w (0-based). */
export function tempoMiles(w: number): number {
  return w < 4 ? 3 : w < 9 ? 4 : 3;
}

/** A run counts as done when logged miles >= this share of planned miles. */
export const RUN_DONE_RATIO = 0.9;
