import { MONTHS, METERS_PER_MILE, fmt, fmtTime, toD, type BoardSport, type RecordKind } from '@/logic';

/** "Oct 5, 2026". */
export function dateText(s: string): string {
  const d = toD(s);
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
}

/** A record's value as it reads: "21:43", "6.2 mi", "1,500 m", "18.4 mph", "320 ft", "7:45 /mi". */
export function recordText(kind: RecordKind, v: number, sport: BoardSport): string {
  switch (kind) {
    case 'time':
      return fmtTime(Math.round(v));
    case 'miles':
      return sport === 'swim' ? `${Math.round(v * METERS_PER_MILE).toLocaleString('en-US')} m` : `${fmt(Math.round(v * 100) / 100)} mi`;
    case 'mph':
      return `${fmt(Math.round(v * 10) / 10)} mph`;
    case 'feet':
      return `${Math.round(v).toLocaleString('en-US')} ft`;
    case 'pace':
      return `${fmtTime(Math.round(v))} /mi`;
    case 'pace100':
      return `${fmtTime(Math.round(v))} /100 m`;
  }
}
