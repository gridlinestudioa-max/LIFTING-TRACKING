import { pad } from './dates';

/**
 * Parse a run time to seconds.
 * "58" = 58 minutes, "58:30" = m:ss, "1:58:30" = h:mm:ss. Returns null if invalid/empty.
 */
export function parseTime(str: string | null | undefined): number | null {
  const t = String(str ?? '').trim();
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

/** Seconds to "m:ss" or "h:mm:ss". */
export function fmtTime(sec: number): string {
  let h = Math.floor(sec / 3600);
  let m = Math.floor((sec % 3600) / 60);
  let s = Math.round(sec % 60);
  if (s === 60) {
    m++;
    s = 0;
  }
  if (m === 60) {
    h++;
    m = 0;
  }
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Pace "m:ss /mi", or "" when miles or time is missing. */
export function paceText(miles: number | null | undefined, secs: number | null | undefined): string {
  if (!(miles! > 0) || !(secs! > 0)) return '';
  const ps = secs! / miles!;
  let m = Math.floor(ps / 60);
  let s = Math.round(ps % 60);
  if (s === 60) {
    m++;
    s = 0;
  }
  return `${m}:${pad(s)} /mi`;
}
