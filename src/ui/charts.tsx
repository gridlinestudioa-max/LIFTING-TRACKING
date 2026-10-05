import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

import { MONTHS, dayDiff, sgn, toD, type BarRow } from '@/logic';

import { useColors } from './theme';

/** SVG scaled to the container width, keeping the viewBox aspect ratio. */
function Chart({ w, h, children, label }: { w: number; h: number; children: React.ReactNode; label: string }) {
  return (
    <View style={{ width: '100%', aspectRatio: w / h }} accessible accessibilityLabel={label}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
        {children}
      </Svg>
    </View>
  );
}

/** Dashed outline = planned, solid = logged. */
export function PlanBars({ rows, label }: { rows: BarRow[]; label: string }) {
  const c = useColors();
  const W = 360, H = 140, padB = 18, padT = 8, n = rows.length, bw = W / n, ph = H - padB - padT;
  const mx = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual)));
  return (
    <Chart w={W} h={H} label={label}>
      {rows.map((r, i) => {
        const x = i * bw + 4, w = bw - 8;
        const hp = (r.planned / mx) * ph, ha = (r.actual / mx) * ph;
        return [
          <Rect key={`p${i}`} x={x} y={H - padB - hp} width={w} height={hp} fill="none" stroke={c.mute} strokeDasharray="3 2" rx={2} />,
          r.actual > 0 ? <Rect key={`a${i}`} x={x} y={H - padB - ha} width={w} height={ha} fill={c.accent} opacity={0.92} rx={2} /> : null,
          <SvgText key={`l${i}`} x={x + w / 2} y={H - 5} textAnchor="middle" fontSize={9} fill={c.mute}>
            {r.label}
          </SvgText>,
        ];
      })}
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
  const N = vals.length, W = 360, H = 160, padT = 12, padB = 16, bw = W / N, ph = H - padT - padB;
  const y = (v: number) => padT + ((mx - v) / (mx - mn)) * ph;
  return (
    <Chart w={W} h={H} label="Daily calorie deficit">
      {vals.map((x, i) => {
        const out = [];
        if (x.v != null) {
          const y0 = y(0), y1 = y(x.v);
          out.push(
            <Rect key={`b${i}`} x={i * bw + 2} y={Math.min(y0, y1)} width={bw - 4} height={Math.max(Math.abs(y1 - y0), 1)} rx={2} fill={x.v >= 0 ? c.ok : c.bad} />,
          );
        }
        out.push(
          <SvgText key={`t${i}`} x={i * bw + bw / 2} y={H - 4} textAnchor="middle" fontSize={8} fill={c.mute}>
            {toD(x.s).getDate()}
          </SvgText>,
        );
        return out;
      })}
      <Line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={c.mute} strokeWidth={1} />
      {g > 0 ? <Line x1={0} x2={W} y1={y(g)} y2={y(g)} stroke={c.accent} strokeDasharray="4 3" strokeWidth={1.5} /> : null}
    </Chart>
  );
}

/** Running total of deficit over logged days, latest total labeled. Needs >= 2 points. */
export function CumulativeLine({ pts }: { pts: { s: string; v: number }[] }) {
  const c = useColors();
  const W = 360, CH = 150, cpT = 14, cpB = 16, cph = CH - cpT - cpB;
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
      <Line x1={0} x2={W} y1={cy(0)} y2={cy(0)} stroke={c.mute} strokeWidth={1} />
      <Polyline fill="none" stroke={c.accent} strokeWidth={2.5} strokeLinejoin="round" points={pts.map((p) => `${cx(p.s)},${cy(p.v)}`).join(' ')} />
      {pts.map((p) => (
        <Circle key={p.s} cx={cx(p.s)} cy={cy(p.v)} r={3} fill={c.accent} />
      ))}
      <SvgText x={Math.min(cx(last.s), W - 4)} y={Math.max(cy(last.v) - 6, 10)} textAnchor="end" fontSize={10} fontWeight="700" fill={c.ink}>
        {sgn(last.v)}
      </SvgText>
      <SvgText x={10} y={CH - 3} fontSize={8} fill={c.mute}>
        {dl(pts[0].s)}
      </SvgText>
      <SvgText x={W - 10} y={CH - 3} textAnchor="end" fontSize={8} fill={c.mute}>
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
      <Polyline fill="none" stroke={c.accent} strokeWidth={2} strokeLinejoin="round" points={P.join(' ')} />
    </Svg>
  );
}
