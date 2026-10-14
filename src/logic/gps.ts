// Recording an activity with GPS: distance, climbing and mile splits from a stream of position fixes,
// and a route small enough to keep. Pure logic, no React.
//
// Phone GPS is noisy, so a fix is used only when it's reasonably accurate, has moved a few meters
// (standing still otherwise adds distance) and implies a believable speed. Climbing counts a rise only
// once it passes a few meters, so altitude jitter doesn't add up.

import { METERS_PER_MILE } from './plans';

export type LatLng = [lat: number, lng: number];

export interface GpsFix {
  lat: number;
  lng: number;
  /** Meters above sea level, when the device reports it. */
  alt?: number | null;
  /** Horizontal accuracy, meters. */
  acc?: number | null;
  /** Milliseconds. */
  t: number;
}

export interface Track {
  /** Route so far. */
  pts: LatLng[];
  meters: number;
  climbM: number;
  /** Moving seconds at each full mile, cumulative. */
  miles: number[];
  last: GpsFix | null;
  /** Altitude climbing is measured from. */
  altBase: number | null;
}

export const EMPTY_TRACK: Track = { pts: [], meters: 0, climbM: 0, miles: [], last: null, altBase: null };

/** Fixes worse than this many meters are ignored. */
export const MAX_ACCURACY_M = 40;
const MIN_STEP_M = 4;
/** Faster than this (m/s, about 200 km/h) is a GPS jump, not movement. */
const MAX_SPEED = 55;
const CLIMB_STEP_M = 4;

/** Meters between two points (haversine). */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371008.8;
  const r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r;
  const dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The track with one more fix. `movingSecs` is the time recorded so far (pauses left out). After a pause,
 * pass `resume` so the gap to the new spot isn't counted as distance.
 */
export function addFix(tr: Track, fix: GpsFix, movingSecs: number, resume = false): Track {
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return tr;
  if (fix.acc != null && fix.acc > MAX_ACCURACY_M) return tr;
  const pt: LatLng = [fix.lat, fix.lng];
  const alt = fix.alt != null && Number.isFinite(fix.alt) ? fix.alt : null;
  if (!tr.last || resume) {
    return { ...tr, pts: [...tr.pts, pt], last: fix, altBase: alt ?? tr.altBase };
  }
  const d = distanceM(tr.last, fix);
  if (d < MIN_STEP_M) return tr;
  const dt = (fix.t - tr.last.t) / 1000;
  if (dt > 0 && d / dt > MAX_SPEED) return tr;
  const meters = tr.meters + d;
  let { climbM, altBase } = tr;
  if (alt != null) {
    if (altBase == null) altBase = alt;
    else if (alt - altBase >= CLIMB_STEP_M) {
      climbM += alt - altBase;
      altBase = alt;
    } else if (altBase - alt >= CLIMB_STEP_M) altBase = alt;
  }
  const miles = [...tr.miles];
  while (meters >= (miles.length + 1) * METERS_PER_MILE) miles.push(Math.round(movingSecs));
  return { pts: [...tr.pts, pt], meters, climbM, miles, last: fix, altBase };
}

/** Seconds for each full mile, from the cumulative mile marks. */
export function splitsOf(marks: number[]): number[] {
  return marks.map((s, i) => s - (i ? marks[i - 1] : 0));
}

// ---------- Keeping the route ----------

/** Flat x/y in meters around a latitude, good enough over a city. */
function project(p: LatLng, lat0: number): [number, number] {
  const r = Math.PI / 180;
  return [p[1] * r * 6371008.8 * Math.cos(lat0 * r), p[0] * r * 6371008.8];
}

function segDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Douglas-Peucker: drops points within `tol` meters of the line through their neighbors. */
export function simplify(pts: LatLng[], tol: number): LatLng[] {
  if (pts.length < 3) return pts.slice();
  const lat0 = pts[0][0];
  const xy = pts.map((p) => project(p, lat0));
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1;
    let max = tol;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(xy[i], xy[a], xy[b]);
      if (d > max) {
        max = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

export const MAX_ROUTE_POINTS = 1500;

/** The route to save: simplified to at most MAX_ROUTE_POINTS, coordinates to about a meter. */
export function compactRoute(pts: LatLng[]): LatLng[] {
  let tol = 2;
  let out = simplify(pts, tol);
  while (out.length > MAX_ROUTE_POINTS) {
    tol *= 1.6;
    out = simplify(pts, tol);
  }
  return out.map(([a, b]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5]);
}

/** A saved route, checked: pairs of valid coordinates, or undefined. */
export function normalizeRoute(v: unknown): LatLng[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((p): p is [number, number] => Array.isArray(p) && p.length >= 2 && Math.abs(Number(p[0])) <= 90 && Math.abs(Number(p[1])) <= 180)
    .map((p) => [Number(p[0]), Number(p[1])] as LatLng)
    .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .slice(0, 5000);
  return out.length >= 2 ? out : undefined;
}

// ---------- Drawing on a map ----------

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function boundsOf(pts: LatLng[]): Bounds | null {
  if (!pts.length) return null;
  let south = 90;
  let north = -90;
  let west = 180;
  let east = -180;
  for (const [lat, lng] of pts) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
    west = Math.min(west, lng);
    east = Math.max(east, lng);
  }
  return { south, west, north, east };
}

export const TILE = 256;

/** World pixel position (Web Mercator) at a zoom level. */
export function toPixel(lat: number, lng: number, z: number): [number, number] {
  const scale = TILE * 2 ** z;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale];
}

/** The closest zoom (up to `max`) that fits the bounds in a w × h box with `pad` pixels around. */
export function fitZoom(b: Bounds, w: number, h: number, pad = 24, max = 17): number {
  for (let z = max; z > 1; z--) {
    const [x1, y1] = toPixel(b.north, b.west, z);
    const [x2, y2] = toPixel(b.south, b.east, z);
    if (x2 - x1 <= w - 2 * pad && y2 - y1 <= h - 2 * pad) return z;
  }
  return 1;
}
