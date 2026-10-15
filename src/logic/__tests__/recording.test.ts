import { describe, expect, it } from '@jest/globals';

import { finishSession, ingest, movingAt, newSession, pauseSession, readSession, resumeSession, type GpsFix } from '..';

const T0 = 1_700_000_000_000;
// About 11 m north per step.
const fix = (i: number, secs: number, extra: Partial<GpsFix> = {}): GpsFix => ({ lat: 40 + i * 0.0001, lng: -74, acc: 5, t: T0 + secs * 1000, ...extra });

describe('recording session', () => {
  it('counts time from timestamps, leaving out pauses', () => {
    let s = newSession('run', T0);
    expect(movingAt(s, T0 + 60_000)).toBe(60);
    s = pauseSession(s, T0 + 60_000);
    expect(movingAt(s, T0 + 600_000)).toBe(60);
    s = resumeSession(s, T0 + 600_000);
    expect(movingAt(s, T0 + 630_000)).toBe(90);
    s = finishSession(s, T0 + 640_000);
    expect(s.phase).toBe('review');
    expect(movingAt(s, T0 + 999_000)).toBe(100);
  });

  it('adds fixes in time order and skips ones already seen', () => {
    let s = newSession('run', T0);
    s = ingest(s, [fix(2, 6), fix(0, 0), fix(1, 3)]);
    const m = s.track.meters;
    expect(m).toBeCloseTo(22.2, 0);
    // The same batch delivered again (background task and screen both report it) changes nothing.
    expect(ingest(s, [fix(1, 3), fix(2, 6)]).track.meters).toBe(m);
  });

  it('ignores fixes while paused and doesn’t bridge the pause', () => {
    let s = ingest(newSession('run', T0), [fix(0, 0), fix(1, 3)]);
    s = pauseSession(s, T0 + 4000);
    s = ingest(s, [fix(50, 60)]);
    expect(s.track.pts).toHaveLength(2);
    s = resumeSession(s, T0 + 100_000);
    s = ingest(s, [fix(100, 101), fix(101, 104)]);
    expect(s.track.meters).toBeCloseTo(22.2, 0);
  });

  it('notes long gaps in GPS (a locked screen in a browser)', () => {
    let s = ingest(newSession('run', T0), [fix(0, 0), fix(1, 3)]);
    s = ingest(s, [fix(30, 303)]);
    expect(s.gaps).toBe(1);
    expect(s.longestGap).toBe(300);
    // The stretch is still covered, as a straight line.
    expect(s.track.meters).toBeGreaterThan(300);
  });

  it('survives a save and load', () => {
    const s = ingest(newSession('bike', T0), [fix(0, 0), fix(1, 3)]);
    const back = readSession(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
    expect(readSession({ v: 2 })).toBeNull();
    expect(readSession(null)).toBeNull();
  });
});
