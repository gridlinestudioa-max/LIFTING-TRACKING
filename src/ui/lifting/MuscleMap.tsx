import { Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Rect } from 'react-native-svg';

import type { MapMuscle } from '@/logic';

import { space, useColors } from '../theme';

type Shape = { m: MapMuscle | null } & ({ k: 'r'; x: number; y: number; w: number; h: number; r?: number } | { k: 'e'; x: number; y: number; rx: number; ry: number });

/** Both sides of a shape at x mirrored around the body's middle (50). */
const pair = (s: Shape): Shape[] => {
  if (s.k === 'r') return [s, { ...s, x: 100 - s.x - s.w }];
  return [s, { ...s, x: 100 - s.x }];
};

const FRONT: Shape[] = [
  { k: 'r', x: 45, y: 23, w: 10, h: 7, r: 2, m: 'neck' },
  ...pair({ k: 'e', x: 31, y: 37, rx: 8, ry: 6.5, m: 'shoulders' }),
  ...pair({ k: 'r', x: 37, y: 31, w: 12.5, h: 15, r: 4, m: 'chest' }),
  ...pair({ k: 'e', x: 25, y: 55, rx: 5.5, ry: 10, m: 'biceps' }),
  ...pair({ k: 'e', x: 21, y: 78, rx: 4.5, ry: 11, m: 'forearms' }),
  { k: 'r', x: 40.5, y: 48, w: 19, h: 30, r: 5, m: 'abdominals' },
  ...pair({ k: 'e', x: 35, y: 84, rx: 4, ry: 6, m: 'abductors' }),
  ...pair({ k: 'r', x: 37.5, y: 88, w: 11, h: 40, r: 5, m: 'quadriceps' }),
  { k: 'r', x: 47.5, y: 90, w: 5, h: 22, r: 2.5, m: 'adductors' },
  ...pair({ k: 'r', x: 38.5, y: 134, w: 9, h: 32, r: 4.5, m: 'calves' }),
];

const BACK: Shape[] = [
  { k: 'r', x: 40, y: 24, w: 20, h: 12, r: 5, m: 'traps' },
  ...pair({ k: 'e', x: 31, y: 37, rx: 8, ry: 6.5, m: 'shoulders' }),
  ...pair({ k: 'e', x: 25, y: 55, rx: 5.5, ry: 10, m: 'triceps' }),
  ...pair({ k: 'e', x: 21, y: 78, rx: 4.5, ry: 11, m: 'forearms' }),
  ...pair({ k: 'r', x: 34, y: 40, w: 8, h: 24, r: 4, m: 'lats' }),
  { k: 'r', x: 42.5, y: 38, w: 15, h: 20, r: 3, m: 'middle back' },
  { k: 'r', x: 42.5, y: 60, w: 15, h: 13, r: 3, m: 'lower back' },
  ...pair({ k: 'r', x: 37.5, y: 75, w: 12, h: 14, r: 6, m: 'glutes' }),
  ...pair({ k: 'r', x: 37.5, y: 91, w: 11, h: 38, r: 5, m: 'hamstrings' }),
  ...pair({ k: 'r', x: 38.5, y: 133, w: 9, h: 33, r: 4.5, m: 'calves' }),
];

function Figure({ shapes, load, x0 }: { shapes: Shape[]; load: Partial<Record<MapMuscle, number>>; x0: number }) {
  const c = useColors();
  const hot = c.types.push;
  return (
    <G x={x0}>
      <Circle cx={50} cy={12} r={9} fill={c.soft} />
      {/* Hands and feet, so the figure reads as a body. */}
      {pair({ k: 'e', x: 19, y: 94, rx: 3.5, ry: 4.5, m: null }).concat(pair({ k: 'e', x: 43, y: 171, rx: 5, ry: 3, m: null })).map((s, i) =>
        s.k === 'e' ? <Ellipse key={`x${i}`} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} fill={c.soft} /> : null,
      )}
      {shapes.map((s, i) => {
        const v = s.m ? (load[s.m] ?? 0) : 0;
        const props = { fill: v ? hot : c.soft, opacity: v ? 0.25 + 0.75 * v : 1 };
        return s.k === 'r' ? <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...props} /> : <Ellipse key={i} cx={s.x} cy={s.y} rx={s.rx} ry={s.ry} {...props} />;
      })}
    </G>
  );
}

/** Front and back of a body, shaded by how much a workout worked each muscle (darker = more sets). */
export function MuscleMap({ load }: { load: Partial<Record<MapMuscle, number>> }) {
  const c = useColors();
  const worked = Object.entries(load)
    .filter(([, v]) => (v ?? 0) >= 0.5)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([m]) => m);
  return (
    <View accessible accessibilityLabel={`Muscle map. Most worked: ${worked.join(', ') || 'none'}`}>
      <View style={{ width: '100%', maxWidth: 360, alignSelf: 'center', aspectRatio: 210 / 180 }}>
        <Svg width="100%" height="100%" viewBox="0 0 210 180">
          <Figure shapes={FRONT} load={load} x0={0} />
          <Figure shapes={BACK} load={load} x0={110} />
        </Svg>
      </View>
      <View style={{ flexDirection: 'row', marginTop: space.xs }}>
        <Text style={{ flex: 1, textAlign: 'center', color: c.mute, fontSize: 12.5, fontWeight: '700' }}>Front</Text>
        <Text style={{ flex: 1, textAlign: 'center', color: c.mute, fontSize: 12.5, fontWeight: '700' }}>Back</Text>
      </View>
    </View>
  );
}
