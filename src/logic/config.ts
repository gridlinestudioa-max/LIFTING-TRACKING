// Storage keys, and the numbers behind the original 12-week half-marathon plan (see plans.ts for all plans).

/** Saved data on the device, before accounts (read once to bring it into the new format). */
export const STORAGE_KEY_V1 = 'mm_tracker_v1';
/** Saved data on the device, per account ("local" when used without an account). */
export const storageKey = (user: string) => `mm_tracker_v2:${user}`;

/** Half marathon: long run miles for weeks 1..12. Week 12 Sunday is race day. */
export const HALF_LONG: readonly number[] = [7, 8, 9, 7, 10, 11, 8, 12, 10, 8, 6, 13.1];

/** Half marathon: easy run miles for week index w (0-based). */
export function HALF_EASY(w: number): number {
  return w === 11 ? 2 : 3;
}

/** Half marathon: tempo run miles for week index w (0-based). */
export function HALF_TEMPO(w: number): number {
  return w < 4 ? 3 : w < 9 ? 4 : 3;
}

/** A planned workout counts as done when the logged distance is at least this share of the plan. */
export const DONE_RATIO = 0.9;
