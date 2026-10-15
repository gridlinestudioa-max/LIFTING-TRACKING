import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  CARDIO_LABEL,
  DAY_NAMES,
  KIND_SHORT,
  METERS_PER_MILE,
  addDays,
  dayStatus,
  fmt,
  planEnd,
  planWeek,
  planWeeks,
  plannedOn,
  toD,
  type CardioData,
} from '@/logic';

import { StatusMark } from '../marks';
import { fonts, tabular, useColors } from '../theme';
import { WeekPager, dayStyles, md } from '../WeekPager';
import { kindColor } from './kinds';

/**
 * Cardio a week at a time: each day's planned distance and how it went. Swipe (or use the arrows) to go
 * back through past weeks or ahead through the plan, to see distances build week to week.
 */
export function WeekStrip({ cardio, today, selected, onSelect }: { cardio: CardioData; today: string; selected: string; onSelect: (s: string) => void }) {
  const first = cardio.sessions.reduce<string | null>((m, x) => (!m || x.date < m ? x.date : m), null);
  const starts = [first, cardio.plan?.start].filter((x): x is string => !!x).sort();

  const sub = useCallback(
    (monday: string) => {
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
      return (
        [
          pw != null ? `Week ${pw + 1}${total ? ` of ${total}` : ''}` : null,
          planned > 0 ? `${fmt(Math.round(planned * 10) / 10)} mi planned` : null,
          done > 0 || monday <= today ? `${fmt(Math.round(done * 10) / 10)} mi done` : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'Nothing planned'
      );
    },
    [cardio, today],
  );

  const day = useCallback((s: string, i: number) => <Day s={s} i={i} cardio={cardio} today={today} selected={s === selected} onSelect={onSelect} />, [cardio, today, selected, onSelect]);

  return <WeekPager today={today} selected={selected} first={starts[0] ?? null} last={planEnd(cardio.plan)} sub={sub} day={day} />;
}

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
  const ring = done ? c.ok : missed ? c.bad : partial ? c.warn : p ? kindColor(c, p.kind) : c.line;
  return (
    <Pressable
      onPress={() => onSelect(s)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${DAY_NAMES[i]} ${md(s)}${sub ? `, ${sub}` : ''}${big ? ` ${big} ${unit}` : ''}${done ? ', done' : missed ? ', missed' : ''}`}
      style={[dayStyles.day, { backgroundColor: selected ? c.soft : 'transparent' }]}>
      <Text style={{ color: isToday ? c.ink : c.mute, fontSize: 11.5, fontWeight: isToday ? '800' : '600' }}>{DAY_NAMES[i]}</Text>
      <Text style={{ color: isToday ? c.ink : c.mute, fontSize: 11, ...tabular }}>{toD(s).getDate()}</Text>
      <View style={[dayStyles.dot, { borderColor: ring, backgroundColor: done ? c.ok : missed ? c.bad : 'transparent' }, isToday && { borderWidth: 3 }]}>
        {done ? <StatusMark kind="done" color="#ffffff" size={14} /> : missed ? <StatusMark kind="missed" color="#ffffff" size={12} /> : null}
      </View>
      <Text style={[dayStyles.big, { color: big ? c.ink : 'transparent', ...tabular }]} numberOfLines={1}>
        {big || '0'}
        <Text style={{ fontFamily: fonts.semi, fontSize: 10, color: c.mute }}>{unit ? ` ${unit}` : ''}</Text>
      </Text>
      <Text style={{ color: p ? kindColor(c, p.kind) : c.mute, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>
        {sub || ' '}
      </Text>
    </Pressable>
  );
}
