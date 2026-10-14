import { Platform, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { MONTHS, dayDiff, fmt, sgn, toD, type WeekBar as BarRow } from '@/logic';

import { fonts, space, useColors } from './theme';

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

type KeyKind = 'planned' | 'logged' | 'deficit' | 'surplus' | 'goal';

function Swatch({ kind }: { kind: KeyKind }) {
  const c = useColors();
  return (
    <Svg width={20} height={12} viewBox="0 0 20 12">
      {kind === 'planned' ? (
        <Rect x={1} y={1} width={18} height={10} rx={2} fill="none" stroke={c.mute} strokeWidth={1.25} strokeDasharray="3 2" />
      ) : kind === 'goal' ? (
        <Line x1={0} x2={20} y1={6} y2={6} stroke={c.ink} strokeWidth={1.75} strokeDasharray="4 3" />
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
  goal: 'Your goal',
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

/** Dashed outline = planned, solid = logged. */
export function PlanBars({ rows, label }: { rows: BarRow[]; label: string }) {
  const c = useColors();
  const W = 360, H = 156, padB = 22, padT = 16, n = rows.length, bw = W / n, ph = H - padB - padT;
  const mx = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual)));
  const base = H - padB;
  return (
    <Chart w={W} h={H} label={label}>
      <SvgText fontFamily={SANS} x={0} y={10} fontSize={11} fill={c.mute}>
        {`${fmt(+mx.toFixed(1))} mi`}
      </SvgText>
      {rows.map((r, i) => {
        const x = i * bw + 4, w = bw - 8;
        const hp = (r.planned / mx) * ph, ha = (r.actual / mx) * ph;
        return [
          <Rect key={`p${i}`} x={x} y={base - hp} width={w} height={hp} fill="none" stroke={c.mute} strokeWidth={1.25} strokeDasharray="3 2" rx={3} />,
          r.actual > 0 ? <Rect key={`a${i}`} x={x} y={base - ha} width={w} height={ha} fill={c.ink} rx={3} /> : null,
          <SvgText fontFamily={SANS} key={`l${i}`} x={x + w / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={c.mute}>
            {r.label}
          </SvgText>,
        ];
      })}
      <Line x1={0} x2={W} y1={base} y2={base} stroke={c.line} strokeWidth={1.5} />
    </Chart>
  );
}

/** Plain bars with a unit, e.g. workouts or miles a week. The latest bar is darkest. */
export function Bars({ rows, unit, label }: { rows: { label: string; v: number }[]; unit: string; label: string }) {
  const c = useColors();
  const W = 360, H = 140, padB = 22, padT = 16, n = rows.length, bw = W / n, ph = H - padB - padT;
  const mx = Math.max(1, ...rows.map((r) => r.v));
  const base = H - padB;
  return (
    <Chart w={W} h={H} label={label}>
      <SvgText fontFamily={SANS} x={0} y={10} fontSize={11} fill={c.mute}>
        {`${fmt(+mx.toFixed(1))} ${unit}`}
      </SvgText>
      {rows.map((r, i) => {
        const x = i * bw + 3, w = bw - 6;
        const hv = (r.v / mx) * ph;
        return [
          r.v > 0 ? <Rect key={`a${i}`} x={x} y={base - hv} width={w} height={hv} fill={c.ink} opacity={i === n - 1 ? 1 : 0.55} rx={3} /> : null,
          (n - 1 - i) % 2 === 0 || n <= 8 ? (
            <SvgText fontFamily={SANS} key={`l${i}`} x={x + w / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill={c.mute}>
              {r.label}
            </SvgText>
          ) : null,
        ];
      })}
      <Line x1={0} x2={W} y1={base} y2={base} stroke={c.line} strokeWidth={1.5} />
    </Chart>
  );
}

/** Green above zero = deficit, red below = surplus, dashed = goal. */
export function DeficitBars({ vals, goal }: { vals: { s: string; v: number | null }[]; goal: number | null }) {
  const c = useColors();
  const g = goal != null && goal > 0 ? goal : 0;
  const nums = vals.filter((x) => x.v != null).map((x) => x.v as number);
  let mx = Math.max(...nums, 0, g);
  const mn = Math.min(...nums, 0);
  if (mx === mn) mx = mn + 1;
  const N = vals.length, W = 360, H = 176, padT = 12, padB = 20, bw = W / N, ph = H - padT - padB;
  const y = (v: number) => padT + ((mx - v) / (mx - mn)) * ph;
  return (
    <Chart w={W} h={H} label="Daily calorie deficit">
      {vals.map((x, i) => {
        const out = [];
        if (x.v != null) {
          const y0 = y(0), y1 = y(x.v);
          out.push(
            <Rect key={`b${i}`} x={i * bw + 2} y={Math.min(y0, y1)} width={bw - 4} height={Math.max(Math.abs(y1 - y0), 1)} rx={3} fill={x.v >= 0 ? c.ok : c.bad} />,
          );
        }
        out.push(
          <SvgText fontFamily={SANS} key={`t${i}`} x={i * bw + bw / 2} y={H - 5} textAnchor="middle" fontSize={10} fill={c.mute}>
            {toD(x.s).getDate()}
          </SvgText>,
        );
        return out;
      })}
      <Line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={c.mute} strokeWidth={1.25} />
      {g > 0 ? <Line x1={0} x2={W} y1={y(g)} y2={y(g)} stroke={c.ink} strokeDasharray="5 3" strokeWidth={1.75} /> : null}
    </Chart>
  );
}

/** Running total of deficit over logged days, latest total labeled. Needs >= 2 points. */
export function CumulativeLine({ pts }: { pts: { s: string; v: number }[] }) {
  const c = useColors();
  const W = 360, CH = 164, cpT = 20, cpB = 22, cph = CH - cpT - cpB;
  const span = Math.max(dayDiff(pts[pts.length - 1].s, pts[0].s), 1);
  let cmx = Math.max(...pts.map((p) => p.v), 0);
  const cmn = Math.min(...pts.map((p) => p.v), 0);
  if (cmx === cmn) cmx = cmn + 1;
  const cy = (v: number) => cpT + ((cmx - v) / (cmx - cmn)) * cph;
  const cx = (s: string) => 10 + (dayDiff(s, pts[0].s) / span) * (W - 20);
  const last = pts[pts.length - 1];
  const dl = (s: string) => `${toD(s).getDate()} ${MONTHS[toD(s).getMonth()].slice(0, 3)}`;
  return (
    <Chart w={W} h={CH} label="Cumulative calorie deficit">
      <Line x1={0} x2={W} y1={cy(0)} y2={cy(0)} stroke={c.mute} strokeWidth={1.25} />
      <Polyline fill="none" stroke={c.ink} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={pts.map((p) => `${cx(p.s)},${cy(p.v)}`).join(' ')} />
      {pts.map((p) => (
        <Circle key={p.s} cx={cx(p.s)} cy={cy(p.v)} r={3.5} fill={c.ink} />
      ))}
      <SvgText x={Math.min(cx(last.s), W - 4)} y={Math.max(cy(last.v) - 8, 13)} textAnchor="end" fontSize={13} fontFamily={fonts.display} fill={last.v >= 0 ? c.ok : c.bad}>
        {sgn(last.v)}
      </SvgText>
      <SvgText fontFamily={SANS} x={10} y={CH - 5} fontSize={10.5} fill={c.mute}>
        {dl(pts[0].s)}
      </SvgText>
      <SvgText fontFamily={SANS} x={W - 10} y={CH - 5} textAnchor="end" fontSize={10.5} fill={c.mute}>
        {dl(last.s)}
      </SvgText>
    </Chart>
  );
}

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
