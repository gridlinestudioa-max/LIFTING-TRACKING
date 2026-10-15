// Taking your data out, and bringing activities in. Pure logic, no React.
//
// Out: everything as JSON, and activities, food and the body log as CSV; a recorded route as GPX.
// In: GPX and TCX activity files, the formats Strava, Garmin and Fitbit exports use. FIT files (a binary
// format) aren't read yet.
//
// There's no XML library in React Native, so the files are read with a small scanner. That also means
// there's nothing like entity expansion for a hostile file to abuse; the file size and point count are capped.

import type { CardioData, CardioSession, CardioType } from './cardio';
import { todayString } from './dates';
import { EMPTY_TRACK, addFix, compactRoute, distanceM, splitsOf, type LatLng } from './gps';
import { MEAL_LABEL, entryTotals, mealOf, newId } from './nutrition';
import { METERS_PER_MILE } from './plans';
import type { DayInfo, TrackerState } from './types';

const FEET_PER_METER = 3.28084;

// ---------- Export ----------

/**
 * One CSV cell. Quoted when it has a comma, quote or line break. Text starting with =, +, - or @ gets a
 * leading apostrophe so a spreadsheet shows it as text instead of running it as a formula.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type Cell = string | number | null | undefined;

const csv = (rows: Cell[][]) => `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

/** All data as one JSON file. */
export function exportJson(state: TrackerState, now: Date = new Date()): string {
  return JSON.stringify({ app: 'training-tracker', format: 1, exportedAt: now.toISOString(), data: state }, null, 2);
}

/** Every cardio session, oldest first. Distances in miles, durations in seconds. */
export function activitiesCsv(c: CardioData): string {
  const rows: Cell[][] = [['date', 'sport', 'distance_mi', 'duration_s', 'pace_s_per_mi', 'elevation_ft', 'avg_hr', 'max_hr', 'calories', 'effort_1_10', 'note']];
  for (const x of [...c.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([
      x.date,
      x.type,
      x.miles != null ? round(x.miles, 3) : null,
      x.secs ?? null,
      x.miles && x.secs ? round(x.secs / x.miles, 1) : null,
      x.elevFt ?? null,
      x.hr ?? null,
      x.maxHr ?? null,
      x.kcal ?? null,
      x.rpe ?? null,
      x.note ?? null,
    ]);
  }
  return csv(rows);
}

/** The food log, one row per entry, with each entry's totals (servings already multiplied in). */
export function foodCsv(state: TrackerState): string {
  const rows: Cell[][] = [['date', 'meal', 'food', 'serving', 'servings', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'note']];
  for (const date of Object.keys(state.meals).sort()) {
    for (const e of [...state.meals[date]].sort((a, b) => a.at - b.at)) {
      const t = entryTotals(e);
      rows.push([date, e.tally ? 'Tally' : MEAL_LABEL[mealOf(e)], e.name, e.serving, e.qty, round(t.kcal, 1), round(t.protein, 1), round(t.carbs, 1), round(t.fat, 1), round(t.fiber, 1), round(t.sugar, 1), e.note ?? null]);
    }
  }
  return csv(rows);
}

/** Weight, water, sleep, steps and the calories typed for each day that has any. */
export function bodyCsv(days: Record<string, DayInfo>): string {
  const rows: Cell[][] = [['date', 'weight_lb', 'water_oz', 'sleep_minutes', 'steps', 'calories_in_typed', 'calories_out', 'note']];
  for (const date of Object.keys(days).sort()) {
    const d = days[date];
    rows.push([date, d.weightLb ?? null, d.waterOz ?? null, d.sleepMins ?? null, d.steps ?? null, d.cin ?? null, d.cout ?? null, d.note ?? null]);
  }
  return csv(rows);
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[ch]!);

const GPX_TYPE: Record<CardioType, string> = {
  run: 'running', walk: 'walking', hike: 'hiking', bike: 'cycling', swim: 'swimming', row: 'rowing', elliptical: 'other', other: 'other',
};

/**
 * A recorded route as a GPX 1.1 file, or null when the session has no route. The app keeps the route and
 * the total time, not a clock reading for every point, so each point's time is spread evenly by distance
 * from noon on the day. Anything that needs the real timing should use the original recording.
 */
export function sessionGpx(x: CardioSession): string | null {
  const pts = x.route;
  if (!pts || pts.length < 2) return null;
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + distanceM({ lat: pts[i - 1][0], lng: pts[i - 1][1] }, { lat: pts[i][0], lng: pts[i][1] }));
  const total = cum[cum.length - 1];
  const start = Date.parse(`${x.date}T12:00:00Z`);
  const timed = !!x.secs && Number.isFinite(start);
  const points = pts.map(([lat, lng], i) => {
    const frac = total > 0 ? cum[i] / total : i / (pts.length - 1);
    const time = timed ? `<time>${new Date(start + frac * x.secs! * 1000).toISOString()}</time>` : '';
    return `      <trkpt lat="${lat}" lon="${lng}">${time}</trkpt>`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Times are estimated: spread evenly by distance from noon on the day. -->',
    '<gpx version="1.1" creator="Training Tracker" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <trk>',
    `    <name>${xmlEscape(x.note?.split('\n')[0].slice(0, 80) || `${x.type} ${x.date}`)}</name>`,
    `    <type>${GPX_TYPE[x.type]}</type>`,
    '    <trkseg>',
    ...points,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');
}

// ---------- Import ----------

/** Files bigger than this (characters) aren't read. A long watch recording is a few megabytes. */
export const MAX_IMPORT_CHARS = 20_000_000;
/** Points used to work out distance and splits. Longer recordings are thinned evenly (about 1 s of 6 at the cap). */
const MAX_FIXES = 6000;
/** A gap this long between points is a pause, not movement. */
const PAUSE_SECS = 60;

export interface ImportedActivity {
  /** What the file says it was, or null (the person picks). */
  type: CardioType | null;
  /** Local date it started, or null when the file has no times. */
  date: string | null;
  miles?: number;
  secs?: number;
  elevFt?: number;
  hr?: number;
  maxHr?: number;
  kcal?: number;
  route?: LatLng[];
  splits?: number[];
  title?: string;
}

export type ParseResult = { ok: true; activities: ImportedActivity[] } | { ok: false; error: string };

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, '&');

/** Plain text for a note: tags and control characters out, one line, shortened. */
const cleanTitle = (s: string | null) => {
  const t = decode(s ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return t || undefined;
};

/** Calls `fn` with the inside and attributes of each `<name ...>...</name>` (or `<name .../>`) in the text, in order. */
function eachBlock(text: string, name: string, fn: (inner: string, attrs: string) => void) {
  const open = `<${name}`;
  let pos = 0;
  for (;;) {
    const at = text.indexOf(open, pos);
    if (at < 0) return;
    const after = text.charCodeAt(at + open.length);
    // Not `<trkpt` when looking for `<trk`: the name must end here.
    if (!(after === 62 || after === 47 || after === 32 || after === 9 || after === 10 || after === 13)) {
      pos = at + open.length;
      continue;
    }
    const gt = text.indexOf('>', at);
    if (gt < 0) return;
    const attrs = text.slice(at + open.length, gt);
    if (text.charCodeAt(gt - 1) === 47) {
      fn('', attrs.slice(0, -1));
      pos = gt + 1;
      continue;
    }
    const close = text.indexOf(`</${name}>`, gt);
    if (close < 0) return;
    fn(text.slice(gt + 1, close), attrs);
    pos = close + name.length + 3;
  }
}

/** Text of the first `<name>...</name>` in a block, ignoring any namespace prefix. */
function firstText(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${name}>`, 'i'));
  return m ? decode(m[1].trim()) : null;
}

/** The number inside `<outer><inner>…</inner></outer>`, e.g. the Value of a heart rate in a TCX file. */
function nestedNumber(block: string, outer: string, inner: string): number | null {
  let found: number | null = null;
  eachBlock(block, outer, (v) => {
    if (found == null) found = numberOrNull(firstText(v, inner));
  });
  return found;
}

const attr = (attrs: string, name: string): string | null => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : null;
};

const numberOrNull = (s: string | null) => {
  if (s == null || s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const timeOrNull = (s: string | null) => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

/** What a sport name from a file means here, or null when it isn't one of ours. */
export function typeFromText(s: string | null): CardioType | null {
  const t = (s ?? '').toLowerCase();
  if (!t) return null;
  if (/run|jog|trail/.test(t)) return 'run';
  if (/cycl|bik|ride/.test(t)) return 'bike';
  if (/swim/.test(t)) return 'swim';
  if (/hik/.test(t)) return 'hike';
  if (/walk/.test(t)) return 'walk';
  if (/\browing\b|\brow\b/.test(t)) return 'row';
  if (/elliptical/.test(t)) return 'elliptical';
  return null;
}

interface Pt {
  lat: number;
  lng: number;
  alt: number | null;
  /** Milliseconds, or null. */
  t: number | null;
  hr: number | null;
}

interface FromPoints {
  miles: number;
  secs?: number;
  elevFt?: number;
  splits?: number[];
  route: LatLng[];
  date: string | null;
  hr?: number;
  maxHr?: number;
}

/** Distance, moving time, climbing, mile splits and a keepable route from a list of points. Null without a real track. */
function fromPoints(all: Pt[]): FromPoints | null {
  const valid = all.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180);
  if (valid.length < 2) return null;
  const timed = valid.every((p) => p.t != null);
  const step = Math.ceil(valid.length / MAX_FIXES);
  let tr = EMPTY_TRACK;
  let moving = 0;
  let prevT: number | null = null;
  for (let i = 0; i < valid.length; i += step) {
    const p = valid[i];
    let resume = false;
    if (timed) {
      if (prevT != null) {
        const dt = (p.t! - prevT) / 1000;
        if (dt < 0) continue;
        if (dt > PAUSE_SECS) resume = true;
        else moving += dt;
      }
      prevT = p.t!;
    }
    // Untimed points are spaced an hour apart so the speed check never drops one.
    tr = addFix(tr, { lat: p.lat, lng: p.lng, alt: p.alt, acc: null, t: timed ? p.t! : i * 3_600_000 }, moving, resume);
  }
  if (tr.pts.length < 2 || tr.meters <= 0) return null;
  const hrs = valid.filter((p) => p.hr != null).map((p) => p.hr!);
  const splits = timed && tr.miles.length ? splitsOf(tr.miles).filter((s) => s > 0) : [];
  return {
    miles: tr.meters / METERS_PER_MILE,
    secs: timed && moving > 0 ? Math.round(moving) : undefined,
    elevFt: tr.climbM > 0 ? Math.round(tr.climbM * FEET_PER_METER) : undefined,
    splits: splits.length ? splits : undefined,
    route: compactRoute(tr.pts),
    date: timed ? todayString(new Date(valid[0].t!)) : null,
    hr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : undefined,
    maxHr: hrs.length ? Math.max(...hrs) : undefined,
  };
}

const validHr = (v: number | null | undefined) => (v != null && v >= 40 && v <= 230 ? Math.round(v) : null);

function parseGpx(text: string): ImportedActivity[] {
  const out: ImportedActivity[] = [];
  eachBlock(text, 'trk', (trk) => {
    const pts: Pt[] = [];
    eachBlock(trk, 'trkpt', (inner, attrs) => {
      const lat = numberOrNull(attr(attrs, 'lat'));
      const lng = numberOrNull(attr(attrs, 'lon'));
      if (lat == null || lng == null) return;
      pts.push({
        lat,
        lng,
        alt: numberOrNull(firstText(inner, 'ele')),
        t: timeOrNull(firstText(inner, 'time')),
        hr: validHr(numberOrNull(firstText(inner, 'hr'))),
      });
    });
    const f = fromPoints(pts);
    if (!f) return;
    out.push({
      type: typeFromText(firstText(trk, 'type')),
      date: f.date,
      miles: f.miles,
      secs: f.secs,
      elevFt: f.elevFt,
      hr: f.hr,
      maxHr: f.maxHr,
      route: f.route,
      splits: f.splits,
      title: cleanTitle(firstText(trk, 'name')),
    });
  });
  return out;
}

function parseTcx(text: string): ImportedActivity[] {
  const out: ImportedActivity[] = [];
  eachBlock(text, 'Activity', (act, attrs) => {
    let secs = 0;
    let meters = 0;
    let kcal = 0;
    let hrWeighted = 0;
    let hrTime = 0;
    let maxHr = 0;
    eachBlock(act, 'Lap', (lap) => {
      const t = numberOrNull(firstText(lap, 'TotalTimeSeconds')) ?? 0;
      secs += t;
      meters += numberOrNull(firstText(lap, 'DistanceMeters')) ?? 0;
      kcal += numberOrNull(firstText(lap, 'Calories')) ?? 0;
      const avg = validHr(nestedNumber(lap, 'AverageHeartRateBpm', 'Value'));
      const max = validHr(nestedNumber(lap, 'MaximumHeartRateBpm', 'Value'));
      if (avg != null && t > 0) {
        hrWeighted += avg * t;
        hrTime += t;
      }
      if (max != null) maxHr = Math.max(maxHr, max);
    });
    const pts: Pt[] = [];
    eachBlock(act, 'Trackpoint', (tp) => {
      const lat = numberOrNull(firstText(tp, 'LatitudeDegrees'));
      const lng = numberOrNull(firstText(tp, 'LongitudeDegrees'));
      if (lat == null || lng == null) return;
      const hr = validHr(nestedNumber(tp, 'HeartRateBpm', 'Value'));
      pts.push({ lat, lng, alt: numberOrNull(firstText(tp, 'AltitudeMeters')), t: timeOrNull(firstText(tp, 'Time')), hr });
    });
    const f = fromPoints(pts);
    // The device's own lap totals beat a recomputed distance and time.
    const miles = meters > 0 ? meters / METERS_PER_MILE : f?.miles;
    const total = secs > 0 ? Math.round(secs) : f?.secs;
    if (!miles && !total) return;
    const startText = firstText(act, 'Id');
    const startMs = timeOrNull(startText);
    out.push({
      type: typeFromText(attr(attrs, 'Sport')),
      date: startMs != null ? todayString(new Date(startMs)) : (f?.date ?? null),
      miles: miles || undefined,
      secs: total || undefined,
      elevFt: f?.elevFt,
      hr: hrTime > 0 ? Math.round(hrWeighted / hrTime) : f?.hr,
      maxHr: maxHr || f?.maxHr,
      kcal: kcal > 0 ? Math.round(kcal) : undefined,
      route: f?.route,
      splits: f?.splits,
    });
  });
  return out;
}

/** Reads a GPX or TCX file's text into activities. */
export function parseActivityFile(text: string): ParseResult {
  if (text.length > MAX_IMPORT_CHARS) return { ok: false, error: 'That file is too large to import (the limit is about 20 MB).' };
  const head = text.slice(0, 4000);
  let activities: ImportedActivity[];
  if (/<gpx[\s>]/i.test(head)) activities = parseGpx(text);
  else if (/<TrainingCenterDatabase[\s>]/i.test(head)) activities = parseTcx(text);
  else return { ok: false, error: 'That doesn’t look like a GPX or TCX activity file. FIT files (.fit) aren’t supported yet.' };
  if (!activities.length) return { ok: false, error: 'No recorded activity found in that file.' };
  return { ok: true, activities };
}

/** A session for the log from an imported activity. `fallback` and `fallbackDate` fill in what the file doesn't say. */
export function sessionFromImport(a: ImportedActivity, fallback: CardioType, fallbackDate: string): CardioSession {
  const x: CardioSession = { id: newId('c'), date: a.date ?? fallbackDate, type: a.type ?? fallback };
  if (a.miles && a.miles > 0) x.miles = round(a.miles, 3);
  if (a.secs && a.secs > 0) x.secs = Math.round(a.secs);
  if (a.elevFt && a.elevFt > 0) x.elevFt = Math.round(a.elevFt);
  const hr = validHr(a.hr);
  if (hr) x.hr = hr;
  const maxHr = validHr(a.maxHr);
  if (maxHr) x.maxHr = maxHr;
  if (a.kcal && a.kcal > 0) x.kcal = Math.round(a.kcal);
  if (a.route && a.route.length >= 2) x.route = a.route;
  if (a.splits?.length) x.splits = a.splits;
  if (a.title) x.note = a.title;
  return x;
}

/** The same activity is already logged: same day and sport, nearly the same distance and time. */
export function isDuplicate(existing: readonly CardioSession[], x: CardioSession): boolean {
  return existing.some(
    (y) => y.date === x.date && y.type === x.type && Math.abs((y.miles ?? 0) - (x.miles ?? 0)) < 0.02 && Math.abs((y.secs ?? 0) - (x.secs ?? 0)) <= 5,
  );
}
