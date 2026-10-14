import { describe, expect, it } from '@jest/globals';

import {
  EMPTY_TRACK,
  METERS_PER_MILE,
  addFix,
  boardSummary,
  compactRoute,
  distanceM,
  fitZoom,
  metricValue,
  normalizeCardio,
  normalizePhone,
  personalBoard,
  rankBoard,
  recordsSetBy,
  simplify,
  splitsOf,
  type BoardPerson,
  type CardioData,
  type CardioSession,
  type LatLng,
} from '..';

// About 111 m per 0.001° of latitude.
const north = (i: number, step = 0.0001): LatLng => [40 + i * step, -74];

describe('gps track', () => {
  it('measures distance with haversine', () => {
    expect(distanceM({ lat: 40, lng: -74 }, { lat: 40.001, lng: -74 })).toBeCloseTo(111.2, 0);
  });

  it('adds distance, ignores jitter, bad accuracy and jumps', () => {
    let tr = EMPTY_TRACK;
    for (let i = 0; i < 10; i++) tr = addFix(tr, { lat: north(i)[0], lng: -74, acc: 5, t: i * 3000 }, i * 3);
    expect(tr.meters).toBeCloseTo(9 * 11.12, 0);
    const before = tr.meters;
    tr = addFix(tr, { lat: north(9)[0] + 0.00001, lng: -74, acc: 5, t: 31000 }, 31); // ~1 m: jitter
    tr = addFix(tr, { lat: north(20)[0], lng: -74, acc: 120, t: 34000 }, 34); // poor accuracy
    tr = addFix(tr, { lat: 41, lng: -74, acc: 5, t: 35000 }, 35); // 100 km in a second
    expect(tr.meters).toBe(before);
  });

  it('does not count the gap after a pause', () => {
    let tr = addFix(EMPTY_TRACK, { lat: 40, lng: -74, t: 0 }, 0);
    tr = addFix(tr, { lat: 40.01, lng: -74, t: 600000 }, 0, true);
    expect(tr.meters).toBe(0);
    expect(tr.pts).toHaveLength(2);
  });

  it('counts climbing past a threshold, not altitude noise', () => {
    let tr = EMPTY_TRACK;
    const alts = [100, 102, 99, 101, 106, 110, 108, 115];
    alts.forEach((a, i) => (tr = addFix(tr, { lat: north(i)[0], lng: -74, alt: a, t: i * 5000 }, i * 5)));
    expect(tr.climbM).toBe(15);
  });

  it('marks each mile and turns marks into splits', () => {
    let tr = EMPTY_TRACK;
    // 0.001° ≈ 111 m steps, 30 s each: a mile every ~14.5 steps.
    for (let i = 0; i <= 30; i++) tr = addFix(tr, { lat: north(i, 0.001)[0], lng: -74, t: i * 30000 }, i * 30);
    expect(tr.miles).toHaveLength(Math.floor(tr.meters / METERS_PER_MILE));
    expect(splitsOf([420, 850, 1270])).toEqual([420, 430, 420]);
  });

  it('simplifies straight lines and keeps corners', () => {
    const line: LatLng[] = [...Array.from({ length: 50 }, (_, i) => north(i)), ...Array.from({ length: 50 }, (_, i) => [40.0049, -74 + (i + 1) * 0.0001] as LatLng)];
    const s = simplify(line, 2);
    expect(s.length).toBeLessThan(6);
    expect(s).toContainEqual(north(49));
    expect(compactRoute(line).length).toBeLessThanOrEqual(1500);
  });

  it('fits a zoom level to a box', () => {
    const b = { south: 40, west: -74.01, north: 40.01, east: -74 };
    expect(fitZoom(b, 360, 240)).toBe(14);
  });

  it('keeps routes and splits through a save and load', () => {
    const x = { id: 'c1', date: '2026-10-10', type: 'run', miles: 2, secs: 960, route: [[40, -74], [40.01, -74], ['bad']], splits: [470, 490] };
    const back = normalizeCardio({ sessions: [x] }).sessions[0];
    expect(back.route).toEqual([[40, -74], [40.01, -74]]);
    expect(back.splits).toEqual([470, 490]);
  });
});

const run = (id: string, date: string, miles: number, secs: number, extra: Partial<CardioSession> = {}): CardioSession => ({ id, date, type: 'run', miles, secs, ...extra });
const cardio = (sessions: CardioSession[]): CardioData => ({ plan: null, sessions, skips: [] });

describe('personal records', () => {
  const c = cardio([
    run('a', '2026-09-01', 3.2, 1600), // 8:20/mi
    run('b', '2026-09-10', 6.3, 3000), // 7:56/mi
    run('c', '2026-09-20', 1.2, 500, { splits: [400] }), // fastest mile split 6:40
    run('d', '2026-10-01', 13.2, 7000),
    { id: 'r', date: '2026-10-02', type: 'bike', miles: 20, secs: 3600 },
  ]);

  it('ranks top efforts per category', () => {
    const b = personalBoard(c, 'run', '2026-10-14');
    const by = Object.fromEntries(b.map((x) => [x.id, x]));
    expect(by.mile.top[0]).toMatchObject({ sessionId: 'c', value: 400 });
    expect(by['5k'].top.map((e) => e.sessionId)).toEqual(['b', 'a', 'd']);
    expect(by.longest.top[0].sessionId).toBe('d');
    expect(by.marathon).toBeUndefined();
    expect(personalBoard(c, 'bike', '2026-10-14').find((x) => x.id === 'speed')!.top[0].value).toBe(20);
  });

  it('says which records a session holds', () => {
    const prs = recordsSetBy(c, c.sessions[3], '2026-10-14');
    expect(prs).toContain('Longest run');
    // The only half marathon so far: nothing to beat yet.
    expect(prs).not.toContain('Half marathon');
  });
});

describe('friends', () => {
  it('normalizes phone numbers', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('1 555 123 4567')).toBe('+15551234567');
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('0044 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('12345')).toBeNull();
  });

  it('summarizes and ranks, with old weeks counting as 0', () => {
    const today = '2026-10-14';
    const mine = boardSummary(cardio([run('a', '2026-10-13', 4, 2000), run('b', '2026-10-01', 3.2, 1500)]), today);
    expect(mine.run.weekMi).toBe(4);
    expect(mine.run.monthMi).toBe(7.2);
    expect(mine.run.best).toBeGreaterThan(0);
    const old = { ...boardSummary(cardio([run('x', '2026-09-01', 10, 5000)]), '2026-09-02') };
    expect(metricValue(old, 'run', 'week', today)).toBe(0);
    expect(metricValue(old, 'run', 'longest', today)).toBe(10);
    const people: BoardPerson[] = [
      { id: 'me', name: 'Me', me: true, summary: mine },
      { id: 'o', name: 'Old', me: false, summary: old },
      { id: 'n', name: 'New', me: false, summary: null },
    ];
    const week = rankBoard(people, 'run', 'week', today);
    expect(week.map((r) => [r.p.id, r.rank])).toEqual([['me', 1], ['o', 2], ['n', null]]);
    const fast = rankBoard(people, 'run', 'best', today);
    expect(fast[0].p.id).toBe('me');
  });
});
