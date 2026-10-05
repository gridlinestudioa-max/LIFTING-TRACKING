// Local-date helpers. Dates are 'YYYY-MM-DD' strings in local time.

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const pad = (n: number): string => String(n).padStart(2, '0');

export function toS(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days from b to a (a - b). */
export function dayDiff(a: string, b: string): number {
  return Math.round((toD(a).getTime() - toD(b).getTime()) / 864e5);
}

export function addDays(s: string, n: number): string {
  const d = toD(s);
  d.setDate(d.getDate() + n);
  return toS(d);
}

/** Monday-first weekday index: 0 = Mon .. 6 = Sun. */
export function weekdayIndex(s: string): number {
  return (toD(s).getDay() + 6) % 7;
}

/** The Monday of the week containing s. */
export function mondayOf(s: string): string {
  return addDays(s, -weekdayIndex(s));
}

export function todayString(now: Date = new Date()): string {
  return toS(now);
}

/** "Mon, Oct 5" */
export function shortDayLabel(s: string): string {
  const d = toD(s);
  return `${DAY_NAMES[weekdayIndex(s)]}, ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

/** Monday-first offset of the 1st of the month. */
export function monthOffset(y: number, m: number): number {
  return (new Date(y, m, 1).getDay() + 6) % 7;
}
