import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DAY_NAMES, addDays, firstWorkout, liftDay, toD, type TrackerState } from '@/logic';

import { StatusMark } from '../marks';
import { tabular, useColors } from '../theme';
import { WeekPager, dayStyles, md } from '../WeekPager';

/**
 * Lifting a week at a time: each day's workout and whether it was done. Swipe (or use the arrows) to go
 * back through past weeks or ahead to see what's scheduled.
 */
export function LiftWeekStrip({ state, today, selected, onSelect }: { state: TrackerState; today: string; selected: string; onSelect: (s: string) => void }) {
  const since = useMemo(() => firstWorkout(state), [state]);

  const sub = useCallback(
    (monday: string) => {
      let planned = 0;
      let done = 0;
      for (let i = 0; i < 7; i++) {
        const d = liftDay(state, addDays(monday, i), today, since);
        if (d.routine || d.workout) planned++;
        if (d.mark === 'done') done++;
      }
      if (!planned) return 'Nothing scheduled';
      return monday > today ? `${planned} workouts scheduled` : `${done} of ${planned} workouts done`;
    },
    [state, today, since],
  );

  const day = useCallback(
    (s: string, i: number) => <Day s={s} i={i} state={state} today={today} since={since} selected={s === selected} onSelect={onSelect} />,
    [state, today, since, selected, onSelect],
  );

  return <WeekPager today={today} selected={selected} first={since} last={null} sub={sub} day={day} />;
}

function Day({
  s,
  i,
  state,
  today,
  since,
  selected,
  onSelect,
}: {
  s: string;
  i: number;
  state: TrackerState;
  today: string;
  since: string | null;
  selected: boolean;
  onSelect: (s: string) => void;
}) {
  const c = useColors();
  const d = liftDay(state, s, today, since);
  const done = d.mark === 'done';
  const missed = d.mark === 'missed';
  const isToday = s === today;
  const ring = done ? c.ok : missed ? c.bad : d.mark === 'planned' ? c.ink : c.line;
  return (
    <Pressable
      onPress={() => onSelect(s)}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${DAY_NAMES[i]} ${md(s)}${d.label ? `, ${d.label}` : ', rest'}${done ? ', done' : missed ? ', missed' : ''}`}
      style={[dayStyles.day, { backgroundColor: selected ? c.soft : 'transparent' }]}>
      <Text style={{ color: isToday ? c.ink : c.mute, fontSize: 11.5, fontWeight: isToday ? '800' : '600' }}>{DAY_NAMES[i]}</Text>
      <Text style={{ color: isToday ? c.ink : c.mute, fontSize: 11, ...tabular }}>{toD(s).getDate()}</Text>
      <View style={[dayStyles.dot, { borderColor: ring, backgroundColor: done ? c.ok : missed ? c.bad : 'transparent' }, isToday && { borderWidth: 3 }]}>
        {done ? <StatusMark kind="done" color="#ffffff" size={14} /> : missed ? <StatusMark kind="missed" color="#ffffff" size={12} /> : null}
      </View>
      <Text style={{ color: d.label ? c.ink : c.mute, fontSize: 11, fontWeight: '800', maxWidth: 48, marginTop: 2 }} numberOfLines={1}>
        {d.label ?? ' '}
      </Text>
    </Pressable>
  );
}
