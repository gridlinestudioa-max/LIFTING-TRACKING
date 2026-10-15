import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { MONTHS, addDays, mondayOf, toD } from '@/logic';

import { fonts, radius, space, useColors } from './theme';

/** Weeks to offer before the earliest date and after the latest. */
const PAD_WEEKS = 8;

export const md = (s: string) => `${MONTHS[toD(s).getMonth()].slice(0, 3)} ${toD(s).getDate()}`;

/** "Oct 13 – 19" or "Sep 29 – Oct 5". */
export function weekRange(monday: string): string {
  const sunday = addDays(monday, 6);
  return toD(monday).getMonth() === toD(sunday).getMonth() ? `${md(monday)} – ${toD(sunday).getDate()}` : `${md(monday)} – ${md(sunday)}`;
}

/**
 * A week at a time, Monday to Sunday. Swipe (or use the arrows) to go back through past weeks or ahead.
 * Used by Cardio and Lifting, which draw their own days and the line under the dates.
 */
export function WeekPager({
  today,
  selected,
  first,
  last,
  sub,
  day,
}: {
  today: string;
  selected: string;
  /** Earliest and latest dates worth showing (the pager adds a few weeks either side). */
  first: string | null;
  last: string | null;
  /** The line under the week's dates, e.g. "Week 3 of 12 · 14 mi planned". */
  sub: (monday: string) => string;
  /** One day's cell. */
  day: (s: string, i: number) => ReactNode;
}) {
  const c = useColors();
  const [w, setW] = useState(0);
  const list = useRef<FlatList<string>>(null);

  const weeks = useMemo(() => {
    const starts = [today, first].filter((x): x is string => !!x).sort();
    const end = [today, last].filter((x): x is string => !!x).sort().reverse()[0];
    const from = addDays(mondayOf(starts[0]), -7 * PAD_WEEKS);
    const to = addDays(mondayOf(end), 7 * PAD_WEEKS);
    const out: string[] = [];
    for (let s = from; s <= to; s = addDays(s, 7)) out.push(s);
    return out;
  }, [first, last, today]);

  const startIndex = Math.max(0, weeks.indexOf(mondayOf(selected)));
  const [index, setIndex] = useState(startIndex);

  const go = (i: number) => {
    const n = Math.max(0, Math.min(weeks.length - 1, i));
    setIndex(n);
    list.current?.scrollToIndex({ index: n, animated: true });
  };
  // Follows the swipe as it goes (browsers don't report when a scroll settles).
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!w) return;
      const i = Math.round(e.nativeEvent.contentOffset.x / w);
      setIndex((cur) => (cur === i ? cur : i));
    },
    [w],
  );
  const monday = weeks[index] ?? mondayOf(today);

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={[st.card, { backgroundColor: c.card }]}>
      <View style={st.head}>
        <Nav label="‹" a11y="Previous week" onPress={() => go(index - 1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[st.title, { color: c.ink }]}>{weekRange(monday)}</Text>
          <Text style={{ color: c.mute, fontSize: 12.5 }} numberOfLines={1}>
            {sub(monday)}
          </Text>
        </View>
        <Nav label="›" a11y="Next week" onPress={() => go(index + 1)} />
      </View>
      {w > 0 ? (
        <FlatList
          ref={list}
          data={weeks}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
          keyExtractor={(m) => m}
          onScroll={onScroll}
          scrollEventThrottle={32}
          windowSize={5}
          initialNumToRender={3}
          extraData={day}
          renderItem={({ item }) => <Week monday={item} width={w} day={day} />}
        />
      ) : (
        <View style={{ height: 116 }} />
      )}
      {mondayOf(today) !== monday ? (
        <Pressable onPress={() => go(weeks.indexOf(mondayOf(today)))} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.xs }}>
          <Text style={{ color: c.ink, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' }}>This week</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Nav({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={a11y} hitSlop={8} style={({ pressed }) => [st.nav, { borderColor: c.line, backgroundColor: pressed ? c.soft : c.card }]}>
      <Text style={{ fontSize: 20, color: c.ink, lineHeight: 22 }}>{label}</Text>
    </Pressable>
  );
}

const Week = memo(function Week({ monday, width, day }: { monday: string; width: number; day: (s: string, i: number) => ReactNode }) {
  return (
    <View style={{ width, paddingHorizontal: space.md, flexDirection: 'row' }}>
      {Array.from({ length: 7 }, (_, i) => (
        <View key={i} style={{ flex: 1 }}>
          {day(addDays(monday, i), i)}
        </View>
      ))}
    </View>
  );
});

/** The look shared by day cells: the weekday, the date, a round mark, a big number and a short label. */
export const dayStyles = StyleSheet.create({
  day: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: radius.sm },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  big: { fontFamily: fonts.display, fontSize: 17, lineHeight: 20 },
});

const st = StyleSheet.create({
  card: { borderRadius: radius.lg, paddingVertical: space.md, marginBottom: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, marginBottom: space.sm },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  nav: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
