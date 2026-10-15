import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  activeWorkout,
  firstWorkout,
  liftDay,
  liftMedals,
  applyTemplate,
  liftingPlan,
  newId,
  scheduledRoutine,
  shortDayLabel,
  workoutFromRoutine,
  type Routine,
  type Workout,
} from '@/logic';
import { Header, Mute, Section } from '@/ui/components';
import { Button, LinkButton, Sheet } from '@/ui/food/kit';
import { ExercisePicker } from '@/ui/lifting/ExercisePicker';
import { LiftPlanPicker, type LiftChoice } from '@/ui/lifting/LiftPlanPicker';
import { LiftWeekStrip } from '@/ui/lifting/LiftWeekStrip';
import { useLibrary } from '@/ui/lifting/library';
import { RoutineSheet } from '@/ui/lifting/RoutineSheet';
import { WorkoutSheet } from '@/ui/lifting/WorkoutSheet';
import { MedalBadge } from '@/ui/Medal';
import { HistoryRow, WeekTiles, routineColor } from '@/ui/PlanGraphics';
import { StatusMark } from '@/ui/marks';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, useColors } from '@/ui/theme';

type Open = { kind: 'workout' | 'routine'; id: string } | { kind: 'library' } | { kind: 'start' } | { kind: 'plan' } | null;

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

  const [selected, setSelected] = useState(today);
  const active = activeWorkout(L);
  const todays = scheduledRoutine(L, today);
  const doneToday = L.workouts.find((w) => w.done && w.date === today);
  const medals = useMemo(() => liftMedals(L, today), [L, today]);
  const history = L.workouts.filter((w) => w.done).sort((a, b) => b.date.localeCompare(a.date));
  const [shown, setShown] = useState(15);

  const start = (r: Routine | null) => {
    const id = newId('w');
    const w: Workout = { ...(r ? workoutFromRoutine(L, r, today, byId, id) : { id, date: today, name: 'Workout', done: false, exercises: [] }), start: Date.now() };
    update((s) => ({ ...s, lifting: { ...s.lifting, workouts: [...s.lifting.workouts, w] } }));
    show({ kind: 'workout', id });
  };
  const newRoutine = () => {
    const id = newId('r');
    update((s) => ({ ...s, lifting: { ...s.lifting, routines: [...s.lifting.routines, { id, name: 'New routine', items: [] }] } }));
    show({ kind: 'routine', id });
  };
  const record = () => {
    if (active) show({ kind: 'workout', id: active.id });
    else if (todays && !doneToday) start(todays);
    else show({ kind: 'start' });
  };

  const day = liftDay(state, selected, today, firstWorkout(state));
  const dayWorkouts = L.workouts.filter((w) => w.date === selected && (w.done || w.id === active?.id));

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title="Lifting" />

        <Button
          label={active ? 'Continue workout' : todays && !doneToday ? `Record a workout: ${todays.name}` : 'Record a workout'}
          primary
          onPress={record}
          style={{ marginBottom: space.lg }}
        />

        <LiftWeekStrip state={state} today={today} selected={selected} onSelect={setSelected} />

        <Section
          title={selected === today ? 'Today' : shortDayLabel(selected)}
          action={selected === today && !active && todays && !doneToday ? <LinkButton label="Other workout" onPress={() => show({ kind: 'start' })} /> : undefined}>
          {dayWorkouts.map((w, i) => (
            <Pressable
              key={w.id}
              onPress={() => show({ kind: 'workout', id: w.id })}
              accessibilityRole="button"
              style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text style={[st.big, { color: c.ink, flexShrink: 1 }]}>{w.done ? `${w.name} ✓` : w.name}</Text>
                  <MedalBadge medals={medals.get(w.id) ?? []} />
                </View>
                {!w.done ? <Mute style={{ fontSize: 13 }}>In progress</Mute> : null}
              </View>
              <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
            </Pressable>
          ))}
          {!dayWorkouts.length && day.routine ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs }}>
                <Text style={[st.big, { color: c.ink, flex: 1 }]}>{day.routine.name}</Text>
                {day.mark === 'missed' ? (
                  <View style={[st.badge, { backgroundColor: c.badbg }]}>
                    <StatusMark kind="missed" color={c.bad} size={13} />
                    <Text style={{ color: c.bad, fontSize: 13, fontWeight: '700' }}>Missed</Text>
                  </View>
                ) : null}
              </View>
              {selected === today && !active ? <Button label="Start workout" primary onPress={() => start(day.routine)} style={{ marginTop: space.md }} /> : null}
            </>
          ) : null}
          {!dayWorkouts.length && !day.routine ? <Text style={[st.big, { color: c.ink }]}>Rest day</Text> : null}
        </Section>

        <Section title="Your plan" action={L.routines.length ? <LinkButton label="Change plan" onPress={() => show({ kind: 'plan' })} /> : undefined}>
          {L.routines.length ? (
            <>
              <WeekTiles
                days={L.schedule.map((id) => {
                  const r = id ? L.routines.find((x) => x.id === id) : null;
                  return { label: r?.name ?? null, color: routineColor(c, r?.name ?? '') };
                })}
              />
              <View style={st.chips}>
                {L.routines.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => show({ kind: 'routine', id: r.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name}. Edit`}
                    style={({ pressed }) => [st.chip, { borderColor: c.line, opacity: pressed ? 0.6 : 1 }]}>
                    <View style={[st.chipDot, { backgroundColor: routineColor(c, r.name) }]} />
                    <Text style={{ color: c.ink, fontSize: 14, fontWeight: '700' }}>{r.name}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={[st.foot, { borderTopColor: c.line }]}>
                <LinkButton label="New routine" onPress={newRoutine} />
                <LinkButton label="Exercises" onPress={() => show({ kind: 'library' })} color={c.mute} />
              </View>
            </>
          ) : (
            <View style={{ gap: space.sm }}>
              <Button label="Choose a plan" primary onPress={() => show({ kind: 'plan' })} />
              <Button label="Build my own" onPress={newRoutine} />
            </View>
          )}
        </Section>

        <Section title="History">
          {history.length ? null : <Mute>No workouts yet.</Mute>}
          {history.slice(0, shown).map((w, i) => (
            <HistoryRow
              key={w.id}
              date={w.date}
              title={w.name}
              badge={<MedalBadge medals={medals.get(w.id) ?? []} />}
              first={i === 0}
              onPress={() => show({ kind: 'workout', id: w.id })}
              a11y={`${w.name}, ${shortDayLabel(w.date)}. Open`}
            />
          ))}
          {history.length > shown ? (
            <View style={{ flexDirection: 'row', marginTop: space.sm }}>
              <LinkButton label={`Show more (${history.length - shown})`} onPress={() => setShown((n) => n + 20)} />
            </View>
          ) : null}
        </Section>
      </ScrollView>

      {open?.kind === 'workout' ? <WorkoutSheet key={n} visible id={open.id} onClose={() => setOpen(null)} /> : null}
      {open?.kind === 'routine' ? <RoutineSheet key={n} visible id={open.id} onClose={() => setOpen(null)} /> : null}
      {open?.kind === 'library' ? (
        <Sheet visible title="Exercises" onClose={() => setOpen(null)}>
          <ExercisePicker />
        </Sheet>
      ) : null}
      {open?.kind === 'plan' ? <PlanSheet key={n} onClose={() => setOpen(null)} /> : null}
      {open?.kind === 'start' ? (
        <Sheet visible title="Start a workout" onClose={() => setOpen(null)}>
          <View style={{ gap: space.sm }}>
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

/** Switch to a ready-made plan. Current routines stay (and keep their history) but come off the schedule. */
function PlanSheet({ onClose }: { onClose: () => void }) {
  const { state, update } = useTracker();
  const [choice, setChoice] = useState<LiftChoice>({ split: 'ppl', days: 3 });
  return (
    <Sheet visible title="Choose a plan" onClose={onClose}>
      <LiftPlanPicker value={choice} onChange={setChoice} />
      {state.lifting.routines.length ? (
        <Mute style={{ marginTop: space.md, fontSize: 13 }}>
          Your current routines and their history are kept.
        </Mute>
      ) : null}
      <Button
        label="Use this plan"
        primary
        style={{ marginTop: space.lg }}
        onPress={() => {
          update((s) => ({ ...s, lifting: applyTemplate(s.lifting, liftingPlan(choice.split, choice.days), () => newId('r')) }));
          onClose();
        }}
      />
    </Sheet>
  );
}

const st = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 7 },
  chipDot: { width: 10, height: 10, borderRadius: 5 },
  big: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: space.md, marginTop: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
});
