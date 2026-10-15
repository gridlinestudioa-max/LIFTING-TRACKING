import { describe, expect, it } from '@jest/globals';

import {
  EMPTY_CARDIO,
  MAX_IMPORT_CHARS,
  activitiesCsv,
  bodyCsv,
  csvCell,
  defaultState,
  exportJson,
  foodCsv,
  isDuplicate,
  normalize,
  parseActivityFile,
  sessionFromImport,
  sessionGpx,
  typeFromText,
  type CardioSession,
  type FoodEntry,
  type ImportedActivity,
} from '..';

/** One degree of latitude, in meters, on the sphere the app measures with. */
const M_PER_DEG = (Math.PI / 180) * 6371008.8;

interface GenPt {
  lat: number;
  lon: number;
  ele?: number;
  /** Seconds after the start. */
  t?: number;
  hr?: number;
}

const START = '2026-10-12T12:00:00Z';
const iso = (secs: number) => new Date(Date.parse(START) + secs * 1000).toISOString();

function gpx(pts: GenPt[], extra = '<type>running</type><name>Morning run</name>'): string {
  const body = pts
    .map((p) => {
      const ele = p.ele != null ? `<ele>${p.ele}</ele>` : '';
      const time = p.t != null ? `<time>${iso(p.t)}</time>` : '';
      const hr = p.hr != null ? `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>` : '';
      return `<trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}${hr}</trkpt>`;
    })
    .join('\n');
  return `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><trk>${extra}<trkseg>${body}</trkseg></trk></gpx>`;
}

/** A straight run north: a point every ~11 m, every 3 s, climbing half a meter a point. */
function steadyRun(n = 435, opts: { timed?: boolean; hr?: boolean } = {}): GenPt[] {
  const { timed = true, hr = false } = opts;
  return Array.from({ length: n }, (_, i) => ({
    lat: 41.85 + i * 0.0001,
    lon: -87.65,
    ele: 180 + i * 0.5,
    t: timed ? i * 3 : undefined,
    hr: hr ? 140 + (i % 21) : undefined,
  }));
}

const session = (over: Partial<CardioSession> = {}): CardioSession => ({ id: 'c1', date: '2026-10-12', type: 'run', miles: 3, secs: 1500, ...over });

describe('CSV', () => {
  it('quotes cells that need it', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(3.5)).toBe('3.5');
    expect(csvCell(NaN)).toBe('');
  });

  it('keeps a spreadsheet from running text as a formula', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('-5 calories')).toBe("'-5 calories");
    expect(csvCell('@cmd')).toBe("'@cmd");
    // Real negative numbers are numbers, not text.
    expect(csvCell(-5)).toBe('-5');
  });

  it('lists activities oldest first with pace worked out', () => {
    const c = { ...EMPTY_CARDIO, sessions: [session({ date: '2026-10-12', note: 'hot, humid' }), session({ id: 'c0', date: '2026-10-01', miles: 2, secs: 1000, hr: 150, rpe: 6 })], skips: [] };
    const lines = activitiesCsv(c).trim().split('\r\n');
    expect(lines[0]).toBe('date,sport,distance_mi,duration_s,pace_s_per_mi,elevation_ft,avg_hr,max_hr,calories,effort_1_10,note');
    expect(lines[1]).toBe('2026-10-01,run,2,1000,500,,150,,,6,');
    expect(lines[2]).toBe('2026-10-12,run,3,1500,500,,,,,,"hot, humid"');
  });

  it('lists food with servings multiplied into the totals', () => {
    const s = defaultState();
    const e: FoodEntry = { id: 'e1', name: 'Oats, rolled', serving: '1/2 cup', qty: 2, n: { kcal: 150, protein: 5, carbs: 27, fat: 3, fiber: 4, sugar: 1 }, tags: [], at: 480, meal: 'breakfast' };
    s.meals['2026-10-12'] = [e];
    const lines = foodCsv(s).trim().split('\r\n');
    expect(lines[0].startsWith('date,meal,food,serving,servings,calories')).toBe(true);
    expect(lines[1]).toBe('2026-10-12,Breakfast,"Oats, rolled",1/2 cup,2,300,10,54,6,8,2,');
  });

  it('lists the body log by date', () => {
    const lines = bodyCsv({ '2026-10-13': { weightLb: 181.2, sleepMins: 450 }, '2026-10-12': { waterOz: 64, steps: 9000, cin: 2000, cout: 2600, note: '=bad' } }).trim().split('\r\n');
    expect(lines[1]).toBe("2026-10-12,,64,,9000,2000,2600,'=bad");
    expect(lines[2]).toBe('2026-10-13,181.2,,450,,,,');
  });
});

describe('JSON export', () => {
  it('wraps everything, and what it holds loads back unchanged', () => {
    const s = defaultState();
    s.settings.name = 'Sam';
    s.days['2026-10-12'] = { weightLb: 180, waterOz: 40 };
    const out = JSON.parse(exportJson(s, new Date('2026-10-15T10:00:00Z')));
    expect(out.app).toBe('training-tracker');
    expect(out.exportedAt).toBe('2026-10-15T10:00:00.000Z');
    expect(normalize(out.data).days['2026-10-12']).toEqual({ weightLb: 180, waterOz: 40 });
    expect(normalize(out.data).settings.name).toBe('Sam');
  });
});

describe('GPX out', () => {
  it('has nothing to write without a route', () => {
    expect(sessionGpx(session())).toBeNull();
    expect(sessionGpx(session({ route: [[41.85, -87.65]] }))).toBeNull();
  });

  it('writes the route, with times spread by distance, and escapes the note', () => {
    const x = session({
      secs: 600,
      note: 'Lakefront <fast> & "windy"\nsecond line',
      route: [[41.85, -87.65], [41.86, -87.65], [41.87, -87.65]],
    });
    const out = sessionGpx(x)!;
    expect(out).toContain('<gpx version="1.1"');
    expect(out).toContain('<type>running</type>');
    expect(out).toContain('<name>Lakefront &lt;fast&gt; &amp; &quot;windy&quot;</name>');
    expect(out).not.toContain('second line');
    expect(out.match(/<trkpt /g)).toHaveLength(3);
    expect(out).toContain('<time>2026-10-12T12:00:00.000Z</time>');
    // Evenly spaced points: the middle one is halfway, 5 minutes in; the last is at 10.
    expect(out).toContain('<time>2026-10-12T12:05:00.000Z</time>');
    expect(out).toContain('<time>2026-10-12T12:10:00.000Z</time>');
  });

  it('reads back as the same route (this app’s own export can be imported)', () => {
    const x = session({ secs: 1300, route: steadyRun(200, { timed: false }).map((p) => [p.lat, p.lon] as [number, number]) });
    const r = parseActivityFile(sessionGpx(x)!);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.activities[0].type).toBe('run');
    expect(r.activities[0].route!.length).toBeGreaterThan(1);
    expect(r.activities[0].secs).toBeGreaterThan(1250);
  });
});

describe('GPX in', () => {
  it('works out distance, time, splits, climbing and heart rate for a timed run', () => {
    const r = parseActivityFile(gpx(steadyRun(435, { hr: true })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.activities).toHaveLength(1);
    const a = r.activities[0];
    expect(a.type).toBe('run');
    expect(a.title).toBe('Morning run');
    expect(a.date).toBe('2026-10-12');
    // 434 hops of 0.0001 degrees is about 4,826 m, or 2.999 miles.
    const expectedMiles = (434 * 0.0001 * M_PER_DEG) / 1609.344;
    expect(a.miles!).toBeGreaterThan(expectedMiles * 0.995);
    expect(a.miles!).toBeLessThan(expectedMiles * 1.005);
    expect(a.secs).toBe(1302);
    // Two full miles were completed, each in about 7 minutes 15.
    expect(a.splits).toHaveLength(2);
    for (const s of a.splits!) expect(Math.abs(s - 435)).toBeLessThan(8);
    // 217 m of altitude gain, counted in steps of 4 m or more, in feet.
    expect(a.elevFt!).toBeGreaterThan(680);
    expect(a.elevFt!).toBeLessThan(720);
    expect(a.hr!).toBeGreaterThanOrEqual(149);
    expect(a.hr!).toBeLessThanOrEqual(151);
    expect(a.maxHr).toBe(160);
    expect(a.route!.length).toBeGreaterThanOrEqual(2);
  });

  it('leaves a long pause out of both the time and the distance', () => {
    const first = steadyRun(100);
    // Stopped for 10 minutes, then picked up 1 km further on.
    const second = steadyRun(100).map((p, i) => ({ ...p, lat: 41.85 + 0.0099 + 0.009 + i * 0.0001, t: 99 * 3 + 600 + i * 3 }));
    const r = parseActivityFile(gpx([...first, ...second]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.activities[0];
    // Two 99-hop stretches at 3 s a hop; the 600 s gap isn't counted.
    expect(a.secs).toBeGreaterThanOrEqual(590);
    expect(a.secs).toBeLessThanOrEqual(600);
    const meters = a.miles! * 1609.344;
    expect(meters).toBeGreaterThan(2 * 99 * 0.0001 * M_PER_DEG * 0.99);
    expect(meters).toBeLessThan(2 * 99 * 0.0001 * M_PER_DEG * 1.01);
  });

  it('keeps the route but not a time when the points have none', () => {
    const r = parseActivityFile(gpx(steadyRun(300, { timed: false })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.activities[0];
    expect(a.secs).toBeUndefined();
    expect(a.date).toBeNull();
    expect(a.splits).toBeUndefined();
    expect(a.miles!).toBeGreaterThan(2);
  });

  it('reads self-closing points and one activity per track', () => {
    const two =
      '<gpx version="1.1"><trk><name>One</name><trkseg><trkpt lat="41.85" lon="-87.65"/><trkpt lat="41.86" lon="-87.65"/></trkseg></trk>' +
      '<trk><name>Two</name><type>cycling</type><trkseg><trkpt lat="41.9" lon="-87.6"/><trkpt lat="41.95" lon="-87.6"/></trkseg></trk></gpx>';
    const r = parseActivityFile(two);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.activities.map((a) => a.title)).toEqual(['One', 'Two']);
    expect(r.activities.map((a) => a.type)).toEqual([null, 'bike']);
  });

  it('thins a very long recording instead of grinding on it', () => {
    const t0 = Date.now();
    const r = parseActivityFile(gpx(steadyRun(40_000)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 40,000 points, about 3 s apart: close to 120,000 s of movement and 444 km.
    expect(r.activities[0].miles!).toBeGreaterThan(270);
    expect(r.activities[0].route!.length).toBeLessThanOrEqual(1500);
    expect(Date.now() - t0).toBeLessThan(10_000);
  });
});

describe('TCX in', () => {
  const tcx = (sport: string, laps: string, tracks = '') =>
    `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenter/v2"><Activities><Activity Sport="${sport}"><Id>2026-10-12T12:00:00Z</Id>${laps}${tracks}</Activity></Activities></TrainingCenterDatabase>`;
  const lap = (secs: number, meters: number, cal: number, avg: number, max: number) =>
    `<Lap StartTime="2026-10-12T12:00:00Z"><TotalTimeSeconds>${secs}</TotalTimeSeconds><DistanceMeters>${meters}</DistanceMeters><Calories>${cal}</Calories><AverageHeartRateBpm><Value>${avg}</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>${max}</Value></MaximumHeartRateBpm></Lap>`;

  it('takes the device’s lap totals', () => {
    const r = parseActivityFile(tcx('Running', lap(1800, 5000, 350, 150, 175)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.activities[0];
    expect(a.type).toBe('run');
    expect(a.date).toBe('2026-10-12');
    expect(a.miles).toBeCloseTo(5000 / 1609.344, 5);
    expect(a.secs).toBe(1800);
    expect(a.kcal).toBe(350);
    expect(a.hr).toBe(150);
    expect(a.maxHr).toBe(175);
    // A treadmill run has no route.
    expect(a.route).toBeUndefined();
  });

  it('adds up laps, weighting the average heart rate by time', () => {
    const r = parseActivityFile(tcx('Biking', lap(1000, 8000, 200, 120, 150) + lap(3000, 24000, 600, 160, 180)));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.activities[0];
    expect(a.type).toBe('bike');
    expect(a.secs).toBe(4000);
    expect(a.kcal).toBe(800);
    expect(a.hr).toBe(150);
    expect(a.maxHr).toBe(180);
  });

  it('brings in the route when trackpoints have positions, and leaves "Other" for the person to pick', () => {
    const pts = steadyRun(60)
      .map((p) => `<Trackpoint><Time>${iso(p.t!)}</Time><Position><LatitudeDegrees>${p.lat}</LatitudeDegrees><LongitudeDegrees>${p.lon}</LongitudeDegrees></Position><AltitudeMeters>${p.ele}</AltitudeMeters><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>`)
      .join('');
    const r = parseActivityFile(tcx('Other', lap(177, 650, 40, 150, 160), `<Lap><Track>${pts}</Track></Lap>`));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const a = r.activities[0];
    expect(a.type).toBeNull();
    expect(a.route!.length).toBeGreaterThanOrEqual(2);
    expect(a.miles).toBeCloseTo(650 / 1609.344, 5);
  });
});

describe('what happens with a file that is not an activity', () => {
  it('explains plainly', () => {
    const wrong = parseActivityFile('hello world');
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error).toMatch(/GPX or TCX/);
    const empty = parseActivityFile('<gpx version="1.1"><wpt lat="1" lon="2"/></gpx>');
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/No recorded activity/);
  });

  it('refuses a file that is too large', () => {
    const r = parseActivityFile(`<gpx>${'x'.repeat(MAX_IMPORT_CHARS)}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/too large/);
  });

  it('survives truncated and hostile input without hanging or throwing', () => {
    const t0 = Date.now();
    const cut = gpx(steadyRun(50)).slice(0, 1500);
    expect(() => parseActivityFile(cut)).not.toThrow();
    const open = `<gpx version="1.1"><trk><trkseg>${'<trkpt lat="1" lon="2">'.repeat(50_000)}`;
    expect(parseActivityFile(open).ok).toBe(false);
    const lies = '<gpx version="1.1"><trk><trkseg><trkpt lat="999" lon="999"/><trkpt lat="abc" lon="2"/><trkpt lat="1"/></trkseg></trk></gpx>';
    expect(parseActivityFile(lies).ok).toBe(false);
    // A DOCTYPE with entity definitions has no effect; nothing here expands entities.
    const bomb = '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY a "aaaaaaaaaa"><!ENTITY b "&a;&a;&a;&a;&a;">]><gpx version="1.1"><trk><name>&b;</name><trkseg><trkpt lat="41.85" lon="-87.65"/><trkpt lat="41.86" lon="-87.65"/></trkseg></trk></gpx>';
    const r = parseActivityFile(bomb);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.activities[0].title).toBe('&b;');
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it('turns tags in a title into plain text', () => {
    const r = parseActivityFile(
      '<gpx version="1.1"><trk><name>&lt;script&gt;alert(1)&lt;/script&gt;Run</name><trkseg><trkpt lat="41.85" lon="-87.65"/><trkpt lat="41.86" lon="-87.65"/></trkseg></trk></gpx>',
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.activities[0].title).toBe('alert(1)Run');
  });
});

describe('turning an import into a logged session', () => {
  it('reads sport names', () => {
    expect(typeFromText('running')).toBe('run');
    expect(typeFromText('Trail Run')).toBe('run');
    expect(typeFromText('Biking')).toBe('bike');
    expect(typeFromText('VirtualRide')).toBe('bike');
    expect(typeFromText('lap swimming')).toBe('swim');
    expect(typeFromText('hiking')).toBe('hike');
    expect(typeFromText('walking')).toBe('walk');
    expect(typeFromText('rowing')).toBe('row');
    expect(typeFromText('Other')).toBeNull();
    expect(typeFromText('9')).toBeNull();
    expect(typeFromText(null)).toBeNull();
  });

  it('fills in what the file left out, and drops values that make no sense', () => {
    const a: ImportedActivity = { type: null, date: null, miles: 3.10686, secs: 1500.4, hr: 300, maxHr: 175, elevFt: 120.6, kcal: 280.2, title: 'Park loop', route: [[1, 2], [1.1, 2.1]], splits: [480, 490, 500] };
    const x = sessionFromImport(a, 'bike', '2026-10-15');
    expect(x).toMatchObject({ type: 'bike', date: '2026-10-15', miles: 3.107, secs: 1500, maxHr: 175, elevFt: 121, kcal: 280, note: 'Park loop' });
    expect(x.hr).toBeUndefined();
    expect(x.route).toHaveLength(2);
    expect(x.splits).toEqual([480, 490, 500]);
    expect(x.id).toMatch(/^c/);
    // The file's own sport and date win.
    expect(sessionFromImport({ ...a, type: 'swim', date: '2026-10-01' }, 'bike', '2026-10-15')).toMatchObject({ type: 'swim', date: '2026-10-01' });
  });

  it('spots an activity that is already logged', () => {
    const have = [session({ miles: 3.1, secs: 1500 })];
    expect(isDuplicate(have, session({ id: 'new', miles: 3.105, secs: 1503 }))).toBe(true);
    expect(isDuplicate(have, session({ id: 'new', miles: 3.5 }))).toBe(false);
    expect(isDuplicate(have, session({ id: 'new', date: '2026-10-13', miles: 3.1, secs: 1500 }))).toBe(false);
    expect(isDuplicate(have, session({ id: 'new', type: 'bike', miles: 3.1, secs: 1500 }))).toBe(false);
  });
});
