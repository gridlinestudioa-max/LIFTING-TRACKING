import { Pressable, Platform, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { MONTHS, RANGES, dayDiff, fmt, niceTicks, toD, type Range, type WeekBar as BarRow } from '@/logic';

import { radius, space, useColors } from './theme';

/** SVG text falls back to a serif face on the web unless told otherwise. Native already uses the system font. */
const SANS = Platform.select({ web: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', default: undefined });

/**
 * SVG scaled to the container width, keeping the viewBox aspect ratio. The viewBox widths below are
 * close to a phone's content width, so text sizes in the SVG are close to real pixel sizes.
 */
function Chart({ w, h, children, label }: { w: number; h: number; children: React.ReactNode; label: string }) {
  return (
    <View style={{ width: '100%', aspectRatio: w / h }} accessible accessibilityLabel={label}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
        {children}
      </Svg>
    </View>
  );
}

type KeyKind = 'planned' | 'logged' | 'deficit' | 'surplus' | 'goal' | 'weight' | 'trend' | 'fitness' | 'fatigue' | 'eaten' | 'burned';

function Swatch({ kind }: { kind: KeyKind }) {
  const c = useColors();
  return (
    <Svg width={20} height={12} viewBox="0 0 20 12">
      {kind === 'planned' ? (
        <Rect x={1} y={1} width={18} height={10} rx={2} fill="none" stroke={c.mute} strokeWidth={1.25} strokeDasharray="3 2" />
      ) : kind === 'goal' || kind === 'fatigue' || kind === 'burned' ? (
        <Line x1={0} x2={20} y1={6} y2={6} stroke={kind === 'goal' ? c.ink : c.mute} strokeWidth={1.75} strokeDasharray="4 3" />
      ) : kind === 'trend' || kind === 'fitness' || kind === 'eaten' ? (
        <Line x1={0} x2={20} y1={6} y2={6} stroke={c.ink} strokeWidth={2.5} strokeLinecap="round" />
      ) : kind === 'weight' ? (
        <>
          <Circle cx={5} cy={6} r={2.5} fill={c.mute} />
          <Circle cx={15} cy={6} r={2.5} fill={c.mute} />
        </>
      ) : (
        <Rect x={1} y={1} width={18} height={10} rx={2} fill={kind === 'logged' ? c.ink : kind === 'deficit' ? c.ok : c.bad} />
      )}
    </Svg>
  );
}

const KEY_LABELS: Record<KeyKind, string> = {
  planned: 'Planned',
  logged: 'Logged',
  deficit: 'Deficit',
  surplus: 'Surplus',
  goal: 'Your target',
  weight: 'Logged weight',
  trend: 'Weekly trend',
  fitness: 'Fitness',
  fatigue: 'Fatigue',
  eaten: 'Eaten',
  burned: 'Burned',
};

/** What the marks in a chart mean, drawn the way they appear in the chart. */
export function ChartKey({ items }: { items: KeyKind[] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs, marginTop: space.sm }}>
      {items.map((k) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Swatch kind={k} />
          <Text style={{ color: c.mute, fontSize: 12.5 }}>{KEY_LABELS[k]}</Text>
        </View>
      ))}
    </View>
  );
}

/** Week / Month / Year / All switch for a chart. */
export function RangeTabs({ value, onChange, options = RANGES.map((r) => r.id) }: { value: Range; onChange: (r: Range) => void; options?: Range[] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.soft, borderRadius: radius.sm, padding: 3, gap: 2 }} accessibilityRole="tablist">
      {RANGES.filter((r) => options.includes(r.id)).map((r) => {
        const on = r.id === value;
        return (
          <Pressable
            key={r.id}
            onPress={() => onChange(r.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: radius.sm - 2, backgroundColor: on ? c.card : 'transparent' }}>
            <Text style={{ color: on ? c.ink : c.mute, fontSize: 13, fontWeight: on ? '800' : '600' }}>{r.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The line under a chart's range tabs: what time span and what unit, e.g. "Last 30 days · miles per day". */
export function ChartCaption({ children }: { children: string }) {
  const c = useColors();
  return <Text style={{ color: c.mute, fontSize: 12.5, marginTop: space.sm, marginBottom: 2 }}>{children}</Text>;
}

const W = 360;
/** Room on the left for the value axis. */
const GUTTER = 40;

/** Short axis number: 1200 → "1.2k". */
function axisNum(v: number): string {
  const a = Math.abs(v);
  if (a >= 10000) return `${fmt(Math.round(v / 1000))}k`;
  if (a >= 1000) return `${fmt(Math.round(v / 100) / 10)}k`;
  return fmt(Math.round(v * 10) / 10);
}

/** Horizontal grid lines with their values, and the unit above the axis. */
function YAxis({ ticks, y, unit, tick = axisNum }: { ticks: number[]; y: (v: number) => number; unit?: string; tick?: (v: number) => string }) {
  const c = useColors();
  return (
    <>
      {ticks.map((t) => (
        <Line key={`g${t}`} x1={GUTTER} x2={W} y1={y(t)} y2={y(t)} stroke={t === 0 ? c.mute : c.line} strokeWidth={t === 0 ? 1.25 : 1} />
      ))}
      {ticks.map((t) => (
        <SvgText key={`t${t}`} fontFamily={SANS} x={GUTTER - 6} y={y(t) + 4} textAnchor="end" fontSize={10.5} fill={c.mute}>
          {tick(t)}
        </SvgText>
      ))}
      {unit ? (
        <SvgText fontFamily={SANS} x={0} y={9} fontSize={10.5} fontWeight="600" fill={c.mute}>
          {unit}
        </SvgText>
      ) : null}
    </>
  );
}

/** Which x labels to draw so they don't crowd: about 7, always the first and last. */
function showLabel(i: number, n: number): boolean {
  if (n <= 8) return true;
  const k = Math.ceil(n / 7);
  return i === n - 1 || (i % k === 0 && n - 1 - i >= k);
}

/**
 * Bars over time with a value axis. `signed` colors bars above zero green and below red (deficit/surplus);
 * `goal` draws a dashed line. Empty buckets (null) draw nothing. The last bar (now) is darkest.
 */
export function BarChart({
  values,
  labels,
  unit,
  label,
  signed = false,
  goal,
}: {
  values: (number | null)[];
  labels: string[];
  unit?: string;
  label: string;
  signed?: boolean;
  goal?: number | null;
}) {
  const c = useColors();
  const H = 184, padT = 22, padB = 22;
  const nums = values.filter((v): v is number => v != null);
  // A target line: a deficit above zero, a surplus below. Eating what you burn is the zero line already.
  const g = goal != null && goal !== 0 ? goal : null;
  const ticks = niceTicks(Math.min(0, ...nums, g ?? 0), Math.max(0, ...nums, g ?? 0));
  const lo = ticks[0], hi = ticks[ticks.length - 1];
  const y = (v: number) => padT + ((hi - v) / (hi - lo || 1)) * (H - padT - padB);
  const n = values.length;
  const bw = (W - GUTTER) / Math.max(n, 1);
  const gap = Math.min(4, bw * 0.25);
  return (
    <Chart w={W} h={H} label={label}>
      <YAxis ticks={ticks} y={y} unit={unit} />
      {values.map((v, i) => {
        if (v == null || v === 0) return null;
        const x = GUTTER + i * bw + gap / 2;
        const y0 = y(0), y1 = y(v);
        const fill = signed ? (v >= 0 ? c.ok : c.bad) : c.ink;
        return <Rect key={`b${i}`} x={x} y={Math.min(y0, y1)} width={Math.max(bw - gap, 1)} height={Math.max(Math.abs(y1 - y0), 1)} rx={Math.min(3, bw / 4)} fill={fill} opacity={signed || i === n - 1 ? 1 : 0.6} />;
      })}
      {g != null ? <Line x1={GUTTER} x2={W} y1={y(g)} y2={y(g)} stroke={c.ink} strokeDasharray="5 3" strokeWidth={1.75} /> : null}
      {labels.map((l, i) =>
        showLabel(i, n) ? (
          <SvgText key={`l${i}`} fontFamily={SANS} x={GUTTER + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill={c.mute}>
            {l}
          </SvgText>
        ) : null,
      )}
    </Chart>
  );
}

/** Dashed outline = planned, solid = logged, by plan week. */
export function PlanBars({ rows, label, unit = 'mi' }: { rows: BarRow[]; label: string; unit?: string }) {
  const c = useColors();
  const H = 176, padB = 22, padT = 22, n = rows.length, bw = (W - GUTTER) / n;
  const ticks = niceTicks(0, Math.max(0, ...rows.map((r) => Math.max(r.planned, r.actual))));
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => padT + ((hi - v) / (hi || 1)) * (H - padT - padB);
  return (
    <Chart w={W} h={H} label={label}>
      <YAxis ticks={ticks} y={y} unit={unit} />
      {rows.map((r, i) => {
        const x = GUTTER + i * bw + 3, w = bw - 6;
        return [
          <Rect key={`p${i}`} x={x} y={y(r.planned)} width={w} height={y(0) - y(r.planned)} fill="none" stroke={c.mute} strokeWidth={1.25} strokeDasharray="3 2" rx={3} />,
          r.actual > 0 ? <Rect key={`a${i}`} x={x} y={y(r.actual)} width={w} height={y(0) - y(r.actual)} fill={c.ink} rx={3} /> : null,
          showLabel(i, n) ? (
            <SvgText fontFamily={SANS} key={`l${i}`} x={x + w / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill={c.mute}>
              {r.label}
            </SvgText>
          ) : null,
        ];
      })}
    </Chart>
  );
}

export interface LineSeries {
  pts: { s: string; v: number }[];
  /** 'line' is the main line, 'dashed' a secondary one, 'dots' the raw readings. */
  style: 'line' | 'dashed' | 'dots';
  /** Its own color, for charts with several lines. */
  color?: string;
}

const dateLabel = (s: string, years: boolean) => {
  const d = toD(s);
  return years ? `${MONTHS[d.getMonth()].slice(0, 3)} ’${s.slice(2, 4)}` : `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};

/**
 * Dated values with a value axis and dates along the bottom. `from`/`to` fix the time span (the chosen
 * range); otherwise it fits the data. `zero` keeps 0 on the axis (loads, totals); without it the chart
 * zooms to the data (weight). Needs two or more points.
 */
export function LineChart({
  series,
  zero = false,
  unit = '',
  label,
  from,
  to,
  tick,
  refs = [],
}: {
  series: LineSeries[];
  zero?: boolean;
  unit?: string;
  label: string;
  from?: string;
  to?: string;
  /** How to write the axis numbers (default: 1.2k style). */
  tick?: (v: number) => string;
  /** Dashed reference lines, such as a target or 100%. */
  refs?: { v: number; color?: string }[];
}) {
  const c = useColors();
  const all = series.flatMap((s) => s.pts);
  if (all.length < 1 || (all.length < 2 && series.every((x) => x.style !== 'dots'))) return null;
  const H = 184, padT = 22, padB = 22, padR = 8;
  const dates = all.map((p) => p.s).sort();
  const first = from ?? dates[0];
  const last = to ?? dates[dates.length - 1];
  const span = Math.max(dayDiff(last, first), 1);
  const hi = Math.max(...all.map((p) => p.v), ...refs.map((r) => r.v));
  const lo = Math.min(...all.map((p) => p.v), ...refs.map((r) => r.v));
  let ticks: number[];
  if (zero) ticks = niceTicks(lo, hi);
  else {
    // Zoomed: ticks around the data, not from 0.
    const padV = (hi - lo) * 0.15 || 1;
    const base = niceTicks(0, hi + padV - (lo - padV));
    const step = base[1] - base[0];
    const start = Math.floor((lo - padV) / step) * step;
    ticks = [];
    for (let v = start; v < hi + padV + step; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    if (ticks.length > 6) ticks = ticks.filter((_, i) => i % 2 === 0);
  }
  const top = ticks[ticks.length - 1], bottom = ticks[0];
  const x = (s: string) => GUTTER + 4 + (dayDiff(s, first) / span) * (W - GUTTER - 4 - padR);
  const y = (v: number) => padT + ((top - v) / (top - bottom || 1)) * (H - padT - padB);
  const years = first.slice(0, 4) !== last.slice(0, 4) && span > 90;
  const mid = (() => {
    const d = toD(first);
    d.setDate(d.getDate() + Math.round(span / 2));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();
  const inside = (p: { s: string }) => p.s >= first && p.s <= last;
  return (
    <Chart w={W} h={H} label={label}>
      <YAxis ticks={ticks} y={y} unit={unit.trim()} tick={tick} />
      {refs.map((r, i) => (
        <Line key={`r${i}`} x1={GUTTER} x2={W} y1={y(r.v)} y2={y(r.v)} stroke={r.color ?? c.ink} strokeDasharray="5 3" strokeWidth={1.5} />
      ))}
      {series.map((s, i) => {
        const pts = s.pts.filter(inside);
        // Dots only help when they can be told apart.
        if (s.style === 'dots' && pts.length > 60) return null;
        if (s.style === 'dots') return pts.map((p) => <Circle key={`${i}${p.s}`} cx={x(p.s)} cy={y(p.v)} r={s.color ? 3.5 : 2.75} fill={s.color ?? c.mute} />);
        return pts.length < 2 ? null : (
          <Polyline
            key={i}
            fill="none"
            stroke={s.color ?? (s.style === 'line' ? c.ink : c.mute)}
            strokeWidth={s.style === 'line' ? 2.5 : 1.75}
            strokeDasharray={s.style === 'dashed' ? '5 3' : undefined}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={pts.map((p) => `${x(p.s)},${y(p.v)}`).join(' ')}
          />
        );
      })}
      <SvgText fontFamily={SANS} x={GUTTER + 4} y={H - 6} fontSize={10.5} fill={c.mute}>
        {dateLabel(first, years)}
      </SvgText>
      {span >= 6 ? (
        <SvgText fontFamily={SANS} x={x(mid)} y={H - 6} textAnchor="middle" fontSize={10.5} fill={c.mute}>
          {dateLabel(mid, years)}
        </SvgText>
      ) : null}
      <SvgText fontFamily={SANS} x={W - padR} y={H - 6} textAnchor="end" fontSize={10.5} fill={c.mute}>
        {dateLabel(last, years)}
      </SvgText>
    </Chart>
  );
}

export interface StackSeries {
  label: string;
  color: string;
  values: (number | null)[];
}

/**
 * Bars made of colored parts (macros, muscle groups, meals), one bar per bucket. `percent` scales every bar
 * to 100% to show the mix. `goal` draws a dashed target line.
 */
export function StackedBarChart({
  series,
  labels,
  unit,
  label,
  percent = false,
  goal,
}: {
  series: StackSeries[];
  labels: string[];
  unit?: string;
  label: string;
  percent?: boolean;
  goal?: number | null;
}) {
  const c = useColors();
  const H = 184, padT = 22, padB = 22;
  const n = labels.length;
  const totals = labels.map((_, i) => series.reduce((t, sr) => t + (sr.values[i] ?? 0), 0));
  const top = percent ? 100 : Math.max(0, ...totals, goal ?? 0);
  const ticks = niceTicks(0, top || 1);
  const hi = ticks[ticks.length - 1];
  const y = (v: number) => padT + ((hi - v) / (hi || 1)) * (H - padT - padB);
  const bw = (W - GUTTER) / Math.max(n, 1);
  const gap = Math.min(4, bw * 0.25);
  return (
    <Chart w={W} h={H} label={label}>
      <YAxis ticks={ticks} y={y} unit={percent ? '%' : unit} />
      {labels.map((_, i) => {
        const total = totals[i];
        if (!total) return null;
        let base = 0;
        return series.map((sr, k) => {
          const raw = sr.values[i] ?? 0;
          if (raw <= 0) return null;
          const v = percent ? (raw / total) * 100 : raw;
          const y1 = y(base + v);
          const y0 = y(base);
          base += v;
          return <Rect key={`b${i}-${k}`} x={GUTTER + i * bw + gap / 2} y={y1} width={Math.max(bw - gap, 1)} height={Math.max(y0 - y1, 0.5)} fill={sr.color} />;
        });
      })}
      {goal != null && goal > 0 && !percent ? <Line x1={GUTTER} x2={W} y1={y(goal)} y2={y(goal)} stroke={c.ink} strokeDasharray="5 3" strokeWidth={1.75} /> : null}
      {labels.map((l, i) =>
        showLabel(i, n) ? (
          <SvgText key={`l${i}`} fontFamily={SANS} x={GUTTER + i * bw + bw / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill={c.mute}>
            {l}
          </SvgText>
        ) : null,
      )}
    </Chart>
  );
}

/** A key for charts with colored parts or lines. */
export function Legend({ items }: { items: { label: string; color: string; shape?: 'box' | 'line' | 'dash' | 'dot' }[] }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs, marginTop: space.sm }}>
      {items.map((it) => (
        <View key={it.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Svg width={20} height={12} viewBox="0 0 20 12">
            {it.shape === 'line' || it.shape === 'dash' ? (
              <Line x1={0} x2={20} y1={6} y2={6} stroke={it.color} strokeWidth={it.shape === 'line' ? 2.5 : 1.75} strokeDasharray={it.shape === 'dash' ? '4 3' : undefined} />
            ) : it.shape === 'dot' ? (
              <Circle cx={10} cy={6} r={3.5} fill={it.color} />
            ) : (
              <Rect x={1} y={1} width={18} height={10} rx={2} fill={it.color} />
            )}
          </Svg>
          <Text style={{ color: c.mute, fontSize: 12.5 }}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Colors for charts with several parts, readable in light and dark. */
export const SERIES = {
  protein: '#3b7be0',
  carbs: '#d9a21b',
  fat: '#cf4f86',
  palette: ['#3b7be0', '#d9a21b', '#cf4f86', '#2e9e72', '#8a63d2', '#e2703a', '#4aa3b5', '#9b8f6a'],
};

export function Sparkline({ pts }: { pts: number[] }) {
  const c = useColors();
  const mn = Math.min(...pts), mx = Math.max(...pts), r = mx - mn || 1;
  const P = pts.map((v, i) => `${(i / (pts.length - 1)) * 100 + 10},${26 - ((v - mn) / r) * 20}`);
  return (
    <Svg width={70} height={28} viewBox="0 0 120 32">
      <Polyline fill="none" stroke={c.ink} strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" points={P.join(' ')} />
    </Svg>
  );
}
