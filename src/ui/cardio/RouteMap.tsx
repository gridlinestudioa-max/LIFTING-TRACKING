import { useState } from 'react';
import { Image, Linking, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';

import { TILE, boundsOf, fitZoom, toPixel, type LatLng } from '@/logic';

import { radius, useColors } from '../theme';

/** Route line color: one strong color that reads on map tiles in light and dark mode. */
export const ROUTE = '#fc4c02';

/**
 * A route drawn on OpenStreetMap tiles, zoomed to fit. `here` adds a dot for where you are now (while
 * recording). Plain images and SVG, so it works the same in the app and in a browser.
 */
export function RouteMap({
  route,
  here,
  height = 220,
  style,
  maxZoom = 17,
}: {
  route: LatLng[];
  here?: LatLng | null;
  height?: number;
  style?: StyleProp<ViewStyle>;
  maxZoom?: number;
}) {
  const c = useColors();
  const [w, setW] = useState(0);
  const pts = here ? [...route, here] : route;
  const b = boundsOf(pts);

  let body = null;
  if (w > 0 && b) {
    const z = pts.length > 1 ? fitZoom(b, w, height, 28, maxZoom) : Math.min(16, maxZoom);
    const [x1, y1] = toPixel(b.north, b.west, z);
    const [x2, y2] = toPixel(b.south, b.east, z);
    const left = (x1 + x2) / 2 - w / 2;
    const top = (y1 + y2) / 2 - height / 2;
    const n = 2 ** z;
    const tiles: { key: string; uri: string; x: number; y: number }[] = [];
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++) {
      for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({ key: `${z}/${tx}/${ty}`, uri: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`, x: tx * TILE - left, y: ty * TILE - top });
      }
    }
    const xy = (p: LatLng) => {
      const [px, py] = toPixel(p[0], p[1], z);
      return [px - left, py - top] as const;
    };
    const line = route.map((p) => xy(p).map((v) => v.toFixed(1)).join(',')).join(' ');
    const start = route.length ? xy(route[0]) : null;
    const end = route.length > 1 && !here ? xy(route[route.length - 1]) : null;
    const now = here ? xy(here) : null;
    body = (
      <>
        {tiles.map((t) => (
          <Image key={t.key} source={{ uri: t.uri }} style={{ position: 'absolute', left: t.x, top: t.y, width: TILE, height: TILE }} />
        ))}
        <Svg width={w} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
          {route.length > 1 ? (
            <>
              <Polyline points={line} fill="none" stroke="#ffffff" strokeWidth={7} strokeLinejoin="round" strokeLinecap="round" opacity={0.8} />
              <Polyline points={line} fill="none" stroke={ROUTE} strokeWidth={4} strokeLinejoin="round" strokeLinecap="round" />
            </>
          ) : null}
          {start ? <Circle cx={start[0]} cy={start[1]} r={6} fill="#1a9e4b" stroke="#ffffff" strokeWidth={2} /> : null}
          {end ? <Circle cx={end[0]} cy={end[1]} r={6} fill="#d22" stroke="#ffffff" strokeWidth={2} /> : null}
          {now ? (
            <>
              <Circle cx={now[0]} cy={now[1]} r={14} fill="#2a7fff" opacity={0.2} />
              <Circle cx={now[0]} cy={now[1]} r={7} fill="#2a7fff" stroke="#ffffff" strokeWidth={2.5} />
            </>
          ) : null}
        </Svg>
      </>
    );
  }

  return (
    <View
      onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}
      style={[{ height, borderRadius: radius.md, overflow: 'hidden', backgroundColor: c.soft }, style]}
      accessible
      accessibilityLabel="Map of the route">
      {body}
      <Text
        onPress={() => Linking.openURL('https://www.openstreetmap.org/copyright')}
        style={{ position: 'absolute', right: 0, bottom: 0, fontSize: 10, color: '#333', backgroundColor: 'rgba(255,255,255,0.75)', paddingHorizontal: 4, paddingVertical: 1 }}>
        © OpenStreetMap
      </Text>
    </View>
  );
}
