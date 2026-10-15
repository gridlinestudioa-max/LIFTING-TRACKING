// A recording in progress, kept as plain data so it can be saved after every GPS fix and picked up
// again when the app comes back from the background, after the screen was locked, or after the app was
// closed. Time is worked out from timestamps, so it keeps counting while nothing is running.
// Pure logic, no React.

import type { CardioType } from './cardio';
import { addFix, EMPTY_TRACK, normalizeRoute, type GpsFix, type Track } from './gps';

export type RecPhase = 'recording' | 'paused' | 'review';

export interface RecSession {
  v: 1;
  type: CardioType;
  phase: RecPhase;
  /** When it started (ms). */
  startedAt: number;
  /** Moving seconds banked before the current stretch. */
  banked: number;
  /** When the current stretch started (ms); 0 while paused. */
  since: number;
  track: Track;
  /** The next fix starts a new stretch: don't count the distance from the last one (after a pause). */
  resume: boolean;
  /** Time of the latest fix used, so fixes delivered twice (or out of order) are skipped. */
  seenT: number;
  /** Stretches of more than a minute with no GPS while recording (the browser stopped it, a tunnel). */
  gaps: number;
  /** Longest of those, in seconds. */
  longestGap: number;
}

/** A gap in GPS this long while recording is worth telling the person about. */
export const GAP_SECS = 60;

export function newSession(type: CardioType, now: number): RecSession {
  return { v: 1, type, phase: 'recording', startedAt: now, banked: 0, since: now, track: EMPTY_TRACK, resume: false, seenT: 0, gaps: 0, longestGap: 0 };
}

/** Moving seconds at time `t`. */
export function movingAt(s: RecSession, t: number): number {
  return s.banked + (s.phase === 'recording' && s.since ? Math.max(0, t - s.since) / 1000 : 0);
}

export function pauseSession(s: RecSession, t: number): RecSession {
  if (s.phase !== 'recording') return s;
  return { ...s, phase: 'paused', banked: movingAt(s, t), since: 0 };
}

export function resumeSession(s: RecSession, t: number): RecSession {
  if (s.phase === 'recording') return s;
  return { ...s, phase: 'recording', since: t, resume: true };
}

/** Stop the clock and go to the save screen. */
export function finishSession(s: RecSession, t: number): RecSession {
  return { ...pauseSession(s, t), phase: 'review' };
}

/** The session with new fixes added, oldest first. Fixes while paused, or already seen, are skipped. */
export function ingest(s: RecSession, fixes: readonly GpsFix[]): RecSession {
  if (s.phase !== 'recording' || !fixes.length) return s;
  let out = s;
  for (const f of [...fixes].sort((a, b) => a.t - b.t)) {
    if (f.t <= out.seenT || (out.since && f.t < out.since)) continue;
    let { gaps, longestGap } = out;
    if (out.seenT && !out.resume) {
      const gap = (f.t - out.seenT) / 1000;
      if (gap > GAP_SECS) {
        gaps++;
        longestGap = Math.max(longestGap, Math.round(gap));
      }
    }
    const track: Track = addFix(out.track, f, movingAt(out, f.t), out.resume);
    out = { ...out, track, seenT: f.t, resume: track === out.track ? out.resume : false, gaps, longestGap };
  }
  return out;
}

/** A saved session read back, checked. Null when there isn't a usable one. */
export function readSession(v: unknown): RecSession | null {
  const o = v as RecSession | null;
  if (!o || o.v !== 1 || typeof o.type !== 'string' || !['recording', 'paused', 'review'].includes(o.phase)) return null;
  if (![o.startedAt, o.banked, o.since, o.seenT].every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
  const t = o.track;
  if (!t || typeof t.meters !== 'number' || !Array.isArray(t.pts)) return null;
  const pts = normalizeRoute(t.pts) ?? (t.pts.length === 1 ? (t.pts as Track['pts']) : []);
  return {
    ...o,
    gaps: Number(o.gaps) || 0,
    longestGap: Number(o.longestGap) || 0,
    resume: !!o.resume,
    track: { pts, meters: t.meters, climbM: Number(t.climbM) || 0, miles: Array.isArray(t.miles) ? t.miles : [], last: t.last ?? null, altBase: t.altBase ?? null },
  };
}
