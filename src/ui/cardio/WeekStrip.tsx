import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import {
  CARDIO_LABEL,
  DAY_NAMES,
  KIND_SHORT,
  MONTHS,
  METERS_PER_MILE,
  addDays,
  dayStatus,
  fmt,
  mondayOf,
  planEnd,
  planWeek,
  planWeeks,
  plannedOn,
  toD,
  type CardioData,
} from '@/logic';

import { StatusMark } from '../marks';
import { fonts, radius, space, tabular, useColors } from '../theme';
import { kindColor } from './kinds';

/** Weeks to offer before the first activity or plan start, and after the plan ends (or today). */
const PAD_WEEKS = 8;

const md = (s: string) => `${MONTHS[toD(s).getMonth()].slice(0, 3)} ${toD(s).getDate()}`;

/**
 * Cardio a week at a time: each day's planned distance and how it went. Swipe (or use the arrows) to go
 * back through past weeks or ahead through the plan, to see distances build week to week.
 */
export function WeekStrip({ cardio, today, selected, onSelect }: { cardio: CardioData; today: string; selected: string; onSelect: (s: string) => void }) {
  const c = useColors();
  const [w, setW] = useState(0);
  const list = useRef<FlatList<string>>(null);

  const weeks = useMemo(() => {
    const plan = cardio.plan;
    const firstSession = cardio.sessions.reduce<string | null>((m, x) => (!m || x.date < m ? x.date : m), null);
    const starts = [today, firstSession, plan?.start].filter((x): x is string => !!x).sort();
    const end = [today, planEnd(plan)].filter((x): x is string => !!x).sort().reverse()[0];
    const from = addDays(mondayOf(starts[0]), -7 * PAD_WEEKS);
    const to = addDays(mondayOf(end), 7 * PAD_WEEKS);
    const out: string[] = [];
    for (let s = from; s <= to; s = addDays(s, 7)) out.push(s);
    return out;
  }, [cardio.plan, cardio.sessions, today]);

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

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} style={[st.card, { backgroundColor: c.card }]}>
      <View style={st.head}>
        <Nav label="‹" a11y="Previous week" onPress={() => go(index - 1)} />
        <WeekTitle cardio={cardio} monday={weeks[index] ?? mondayOf(today)} today={today} />
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
          renderItem={({ item }) => <Week monday={item} width={w - 2 * space.md} pad={space.md} cardio={cardio} today={today} selected={selected} onSelect={onSelect} />}
        />
      ) : (
        <View style={{ height: 116 }} />
      )}
      {mondayOf(today) !== weeks[index] ? (
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

/** "Oct 13 – 19", the plan week, and planned vs done distance. */
function WeekTitle({ cardio, monday, today }: { cardio: CardioData; monday: string; today: string }) {
  const c = useColors();
  const sunday = addDays(monday, 6);
  let planned = 0;
  let done = 0;
  for (let i = 0; i < 7; i++) {
    const s = addDays(monday, i);
    for (const p of plannedOn(cardio.plan, s)) if (p.sport !== 'swim') planned += p.miles;
    for (const x of cardio.sessions) if (x.date === s && x.type !== 'swim') done += x.miles ?? 0;
  }
  const pw = planWeek(cardio.plan, monday) ?? planWeek(cardio.plan, sunday);
  const total = planWeeks(cardio.plan);
  const range = toD(monday).getMonth() === toD(sunday).getMonth() ? `${md(monday)} – ${toD(sunday).getDate()}` : `${md(monday)} – ${md(sunday)}`;
  const past = sunday < today;
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[st.title, { color: c.ink }]}>{range}</Text>
      <Text style={{ color: c.mute, fontSize: 12.5, ...tabular }} numberOfLines={1}>
        {[
          pw != null ? `Week ${pw + 1}${total ? ` of ${total}` : ''}` : null,
          planned > 0 ? `${fmt(Math.round(planned * 10) / 10)} mi planned` : null,
          done > 0 || past || monday <= today ? `${fmt(Math.round(done * 10) / 10)} mi done` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Nothing planned'}
      </Text>
    </View>
  );
}

const Week = memo(function Week({
  monday,
  width,
  pad,
  cardio,
  today,
  selected,
  onSelect,
}: {
  monday: string;
  width: number;
  pad: number;
  cardio: CardioData;
  today: string;
  selected: string;
  onSelect: (s: string) => void;
}) {
  return (
    <View style={{ width: width + 2 * pad, paddingHorizontal: pad, flexDirection: 'row' }}>
      {Array.from({ length: 7 }, (_, i) => {
        const s = addDays(monday, i);
        return <Day key={s} s={s} i={i} cardio={cardio} today={today} selected={s === selected} onSelect={onSelect} />;
      })}
    </View>
  );
});

function Day({ s, i, cardio, today, selected, onSelect }: { s: string; i: number; cardio: CardioData; today: string; selected: boolean; onSelect: (s: string) => void }) {
  const c = useColors();
  const planned = plannedOn(cardio.plan, s);
  const p = planned[0] ?? null;
  const logged = cardio.sessions.filter((x) => x.date === s);
  const st0 = dayStatus(cardio, s, today);
  const done = st0 === 'done' || st0 === 'moved' || (!p && logged.length > 0);
  const missed = st0 === 'missed';
  const partial = st0 === 'partial';
  const isToday = s === today;
  const swim = (p?.sport ?? logged[0]?.type) === 'swim';
  const loggedMi = logged.reduce((t, x) => t + (x.miles ?? 0), 0);
  // The number under the dot: what's planned (so you can see it build), else what was done.
  const num = p ? p.miles : loggedMi;
  const big = num > 0 ? (swim ? fmt(Math.round(num * METERS_PER_MILE)) : fmt(Math.round(num * 10) / 10)) : '';
  const unit = num > 0 ? (swim ? 'm' : 'mi') : '';
  const sub = p ? (p.race ? 'Race' : planned.length > 1 ? 'Brick' : KIND_SHORT[p.kind]) : logged.length ? CARDIO_LABEL[logged[0].type] : '';
  const ring = done ? c.ok : missed ? c.bad : partial ? c.warn : p ? (p ? kindColor(c, p.kind) : c.line) : c.line;
  return (
    <Pressable
      onPress={() => onSelect(s)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${DAY_NAMES[i]} ${md(s)}${sub ? `, ${sub}` : ''}${big ? ` ${big} ${unit}` : ''}${done ? ', done' : missed ? ', missed' : ''}`}
      style={[st.day, { backgroundColor: selected ? c.soft : 'transparent' }]}>
      <Text style={{ color: isToday ? c.ink : c.mute, fontSize: 11.5, fontWeight: isToday ? '800' : '600' }}>{DAY_NAMES[i]}</Text>
      <Text style={{ color: isToday ? c.ink : c.mute, fontSize: 11, ...tabular }}>{toD(s).getDate()}</Text>
      <View style={[st.dot, { borderColor: ring, backgroundColor: done ? c.ok : missed ? c.bad : 'transparent' }, isToday && { borderWidth: 3 }]}>
        {done ? <StatusMark kind="done" color="#ffffff" size={14} /> : missed ? <StatusMark kind="missed" color="#ffffff" size={12} /> : null}
      </View>
      <Text style={[st.big, { color: big ? c.ink : 'transparent' }]} numberOfLines={1}>
        {big || '0'}
        <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: c.mute }}>{unit ? ` ${unit}` : ''}</Text>
      </Text>
      <Text style={{ color: p ? kindColor(c, p.kind) : c.mute, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
        {sub || ' '}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  card: { borderRadius: radius.lg, paddingVertical: space.md, marginBottom: space.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, marginBottom: space.sm },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  nav: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 6, borderRadius: radius.sm },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginVertical: 2 },
  big: { fontFamily: fonts.display, fontSize: 17, lineHeight: 20, ...tabular },
});
