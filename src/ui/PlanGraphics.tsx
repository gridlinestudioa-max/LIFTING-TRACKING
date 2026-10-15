import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DAY_NAMES, MONTHS, toD } from '@/logic';

import { fonts, radius, space, tabular, useColors, type Palette } from './theme';

export interface PlanDay {
  /** "Push", "5 mi", or null for a rest day. */
  label: string | null;
  /** Fill color of a training day. */
  color?: string;
  done?: boolean;
  today?: boolean;
}

/** A color for a lifting routine from its name: push, pull and legs days get their own. */
export function routineColor(c: Palette, name: string): string {
  if (/push|chest/i.test(name)) return c.types.push;
  if (/pull|back/i.test(name)) return c.types.pull;
  if (/leg|lower/i.test(name)) return c.types.legs;
  if (/upper/i.test(name)) return c.types.tempo;
  return c.types.long;
}

/** A week as seven tiles, Monday first: what's planned each day, colored, with rest days left empty. */
export function WeekTiles({ days }: { days: PlanDay[] }) {
  const c = useColors();
  return (
    <View style={st.week}>
      {days.map((d, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }} accessibilityLabel={`${DAY_NAMES[i]}: ${d.label ?? 'rest'}${d.done ? ', done' : ''}`}>
          <View style={[st.dow, d.today && { backgroundColor: c.ink }]}>
            <Text style={{ color: d.today ? c.card : c.mute, fontSize: 11.5, fontWeight: '800' }}>{DAY_NAMES[i].slice(0, 1)}</Text>
          </View>
          <View
            style={[
              st.tile,
              d.label ? { backgroundColor: d.color ?? c.ink } : { backgroundColor: c.soft },
              d.done && { opacity: 0.55 },
            ]}>
            {d.label ? (
              <Text style={[st.tileText, { color: c.onType }]} numberOfLines={2} adjustsFontSizeToFit>
                {d.done ? '✓' : d.label}
              </Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/** A history row: a date tile, the name, an optional value on the right, and a chevron. */
export function HistoryRow({ date, title, badge, value, first, onPress, a11y }: { date: string; title: string; badge?: ReactNode; value?: string; first: boolean; onPress: () => void; a11y: string }) {
  const c = useColors();
  const d = toD(date);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [st.row, !first && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={[st.date, { backgroundColor: c.soft }]}>
        <Text style={[st.dateNum, { color: c.ink }]}>{d.getDate()}</Text>
        <Text style={{ color: c.mute, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.4 }}>{MONTHS[d.getMonth()].slice(0, 3).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>
          {title}
        </Text>
        {badge}
      </View>
      {value ? <Text style={[st.value, { color: c.ink }]}>{value}</Text> : null}
      <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  week: { flexDirection: 'row', gap: 4 },
  dow: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tile: { width: '100%', height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  tileText: { fontSize: 11, fontWeight: '800', textAlign: 'center', lineHeight: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm + 2 },
  date: { width: 44, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dateNum: { fontFamily: fonts.display, fontSize: 20, lineHeight: 22, ...tabular },
  value: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, ...tabular },
});
