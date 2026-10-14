import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DAY_NAMES,
  activeWorkout,
  defaultIncrement,
  fmtInt,
  fmtW,
  liftWeek,
  newId,
  nextTarget,
  scheduledRoutine,
  shortDayLabel,
  volume,
  workoutFromRoutine,
  type Routine,
  type Workout,
} from '@/logic';
import { Card, Header, Mute, Section } from '@/ui/components';
import { Button, LinkButton, Pill, Sheet } from '@/ui/food/kit';
import { ExercisePicker } from '@/ui/lifting/ExercisePicker';
import { useLibrary } from '@/ui/lifting/library';
import { RoutineSheet } from '@/ui/lifting/RoutineSheet';
import { WorkoutSheet } from '@/ui/lifting/WorkoutSheet';
import { StatusMark } from '@/ui/marks';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors } from '@/ui/theme';

type Open = { kind: 'workout' | 'routine'; id: string } | { kind: 'library' } | { kind: 'start' } | null;

export default function LiftingScreen() {
  const c = useColors();
  const { state, today, update } = useTracker();
  const { byId } = useLibrary();
  const L = state.lifting;
  const [open, setOpen] = useState<Open>(null);
  const [n, setN] = useState(0);
  const show = (o: Open) => {
    setN((x) => x + 1);
    setOpen(o);
  };

  const active = activeWorkout(L);
  const todays = scheduledRoutine(L, today);
  const doneToday = L.workouts.find((w) => w.done && w.date === today);
  const week = liftWeek(L, today);
  const history = L.workouts.filter((w) => w.done).sort((a, b) => b.date.localeCompare(a.date));

  const start = (r: Routine | null) => {
    const id = newId('w');
    const w: Workout = r ? workoutFromRoutine(L, r, today, byId, id) : { id, date: today, name: 'Workout', done: false, exercises: [] };
    update((s) => ({ ...s, lifting: { ...s.lifting, workouts: [...s.lifting.workouts, w] } }));
    show({ kind: 'workout', id });
  };
  const newRoutine = () => {
    const id = newId('r');
    update((s) => ({ ...s, lifting: { ...s.lifting, routines: [...s.lifting.routines, { id, name: 'New routine', items: [] }] } }));
    show({ kind: 'routine', id });
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title="Lifting">
          <View style={st.week}>
            {week.map((d, i) => (
              <View key={d.day} style={st.weekDay}>
                <Text style={{ color: d.day === today ? c.ink : c.mute, fontSize: 12, fontWeight: d.day === today ? '800' : '600' }}>{DAY_NAMES[i]}</Text>
                <View
                  style={[
                    st.weekDot,
                    { borderColor: d.done ? c.ok : d.routine ? c.ink : c.line, backgroundColor: d.done ? c.ok : 'transparent' },
                    d.day === today && { borderWidth: 2.5 },
                  ]}>
                  {d.done ? <StatusMark kind="done" color={c.onAccent} size={14} /> : null}
                </View>
                <Text numberOfLines={1} style={{ color: c.mute, fontSize: 10, maxWidth: 46 }}>
                  {d.done?.name ?? d.routine?.name ?? ''}
                </Text>
              </View>
            ))}
          </View>
        </Header>

        {active ? (
          <Card>
            <Mute>Workout in progress</Mute>
            <Text style={[st.big, { color: c.ink }]}>{active.name}</Text>
            <Mute>
              {active.exercises.reduce((t, x) => t + x.sets.filter((s) => s.done).length, 0)} of{' '}
              {active.exercises.reduce((t, x) => t + x.sets.length, 0)} sets done · started {shortDayLabel(active.date)}
            </Mute>
            <Button label="Continue workout" primary onPress={() => show({ kind: 'workout', id: active.id })} style={{ marginTop: space.md }} />
          </Card>
        ) : (
          <Card>
            <Mute>Today</Mute>
            {doneToday ? (
              <>
                <Text style={[st.big, { color: c.ink }]}>{doneToday.name} done</Text>
                <Mute>{`${fmtInt(volume(doneToday))} lb lifted in total.`}</Mute>
                <Button label="View workout" onPress={() => show({ kind: 'workout', id: doneToday.id })} style={{ marginTop: space.md }} />
              </>
            ) : todays ? (
              <>
                <Text style={[st.big, { color: c.ink }]}>{todays.name}</Text>
                {todays.items.map((it) => {
                  const ex = byId(it.exId);
                  const inc = it.inc ?? (ex ? defaultIncrement(ex) : 5);
                  const t = nextTarget(it.exId, L.workouts, { ...it, inc });
                  return (
                    <View key={it.exId} style={st.planRow}>
                      <Text style={{ flex: 1, color: c.ink, fontSize: 15 }}>
                        {ex?.name ?? 'Exercise'} <Text style={{ color: c.mute }}>{it.sets}×{it.repMin}–{it.repMax}</Text>
                      </Text>
                      <Text style={{ color: t.reason === 'up' ? c.ok : c.ink, fontSize: 15, fontWeight: '700', ...tabular }}>
                        {t.weight != null ? `${fmtW(t.weight)} ${ex?.unit === 'plates' ? 'pl' : 'lb'}` : '–'}
                        {t.reason === 'up' && t.weight != null ? ' ↑' : ''}
                      </Text>
                    </View>
                  );
                })}
                <Button label="Start workout" primary onPress={() => start(todays)} style={{ marginTop: space.md }} />
              </>
            ) : (
              <>
                <Text style={[st.big, { color: c.ink }]}>Rest day</Text>
                <Mute>Nothing scheduled. You can still lift.</Mute>
              </>
            )}
            {!doneToday ? (
              <View style={{ flexDirection: 'row', marginTop: space.md }}>
                <LinkButton label={todays ? 'Do something else' : 'Start a workout'} onPress={() => show({ kind: 'start' })} />
              </View>
            ) : null}
          </Card>
        )}

        <Section title="Routines" note="Tap one to change exercises, rep ranges or days.">
          {L.routines.length ? null : <Mute>No routines yet.</Mute>}
          {L.routines.map((r, i) => {
            const days = L.schedule.map((id, j) => (id === r.id ? DAY_NAMES[j] : null)).filter(Boolean);
            return (
              <Pressable
                key={r.id}
                onPress={() => show({ kind: 'routine', id: r.id })}
                accessibilityRole="button"
                style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{r.name}</Text>
                  <Mute style={{ fontSize: 13 }}>
                    {r.items.length} exercises · {days.length ? days.join(', ') : 'not scheduled'}
                  </Mute>
                </View>
                <Text style={{ color: c.mute, fontSize: 13 }}>Edit</Text>
              </Pressable>
            );
          })}
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, flexWrap: 'wrap' }}>
            <Pill label="New routine" selected={false} onPress={newRoutine} />
            <Pill label="Browse exercises" selected={false} onPress={() => show({ kind: 'library' })} />
          </View>
        </Section>

        <Section title="History">
          {history.length ? null : <Mute>Finished workouts show here.</Mute>}
          {history.slice(0, 20).map((w, i) => (
            <Pressable
              key={w.id}
              onPress={() => show({ kind: 'workout', id: w.id })}
              accessibilityRole="button"
              style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{w.name}</Text>
                <Mute style={{ fontSize: 13 }}>
                  {shortDayLabel(w.date)} · {w.exercises.length} exercises
                </Mute>
              </View>
              <Text style={{ color: c.ink, fontSize: 14, ...tabular }}>{fmtInt(volume(w))} lb</Text>
            </Pressable>
          ))}
        </Section>
      </ScrollView>

      {open?.kind === 'workout' ? <WorkoutSheet key={n} visible id={open.id} onClose={() => setOpen(null)} /> : null}
      {open?.kind === 'routine' ? <RoutineSheet key={n} visible id={open.id} onClose={() => setOpen(null)} /> : null}
      {open?.kind === 'library' ? (
        <Sheet visible title="Exercises" onClose={() => setOpen(null)}>
          <ExercisePicker />
        </Sheet>
      ) : null}
      {open?.kind === 'start' ? (
        <Sheet visible title="Start a workout" onClose={() => setOpen(null)}>
          <Mute>Pick a routine, or start empty and add exercises as you go.</Mute>
          <View style={{ gap: space.sm, marginTop: space.md }}>
            {L.routines.map((r) => (
              <Button key={r.id} label={r.name} onPress={() => start(r)} />
            ))}
            <Button label="Empty workout" primary onPress={() => start(null)} />
          </View>
        </Sheet>
      ) : null}
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  big: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34 },
  planRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingVertical: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  weekDay: { alignItems: 'center', gap: 4, flex: 1 },
  weekDot: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
