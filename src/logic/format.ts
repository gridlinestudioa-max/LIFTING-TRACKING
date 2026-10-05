/** Integers as-is, otherwise one decimal (trailing zero dropped). */
export function fmt(v: number): string {
  return Number.isInteger(v) ? String(v) : String(+Number(v).toFixed(1));
}

/** Rounded integer with thousands separators: 1234.6 -> "1,235". */
export function fmtInt(v: number): string {
  const n = Math.round(Math.abs(v));
  const s = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return v < 0 && n !== 0 ? `-${s}` : s;
}

/** Signed kcal: negative shown with a minus sign "−1,200". */
export function sgn(v: number): string {
  return (v < 0 && Math.round(v) !== 0 ? '−' : '') + fmtInt(Math.abs(v));
}
