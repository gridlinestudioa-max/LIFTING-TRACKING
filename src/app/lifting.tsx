import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DAY_NAMES,
  activeWorkout,
  applyTemplate,
  defaultIncrement,
  fmtW,
  liftWeek,
  liftingPlan,
  newId,
  nextTarget,
  scheduledRoutine,
  shortDayLabel,
  workoutLine,
  workoutFromRoutine,
  type Routine,
  type Workout,
} from '@/logic';
import { Card, Header, Mute, Section } from '@/ui/components';
import { Button, LinkButton, Sheet } from '@/ui/food/kit';
import { ExercisePicker } from '@/ui/lifting/ExercisePicker';
import { LiftPlanPicker, type LiftChoice } from '@/ui/lifting/LiftPlanPicker';
import { useLibrary } from '@/ui/lifting/library';
import { RoutineSheet } from '@/ui/lifting/RoutineSheet';
import { WorkoutSheet } from '@/ui/lifting/WorkoutSheet';
import { StatusMark } from '@/ui/marks';
import { useTracker } from '@/ui/store';
import { fonts, radius, space, tabular, useColors } from '@/ui/theme';

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

  const active = activeWorkout(L);
  const todays = scheduledRoutine(L, today);
  const doneToday = L.workouts.find((w) => w.done && w.date === today);
  const week = liftWeek(L, today);
  const history = L.workouts.filter((w) => w.done).sort((a, b) => b.date.localeCompare(a.date));

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

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Header title="Lifting" />

        <Card style={{ paddingVertical: space.md }}>
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
        </Card>

        {active ? (
          <Section title="In progress">
            <Text style={[st.big, { color: c.ink }]}>{active.name}</Text>
            <Mute>
              {active.exercises.reduce((t, x) => t + x.sets.filter((s) => s.done).length, 0)} of{' '}
              {active.exercises.reduce((t, x) => t + x.sets.length, 0)} sets done
            </Mute>
            <Button label="Continue workout" primary onPress={() => show({ kind: 'workout', id: active.id })} style={{ marginTop: space.md }} />
          </Section>
        ) : (
          <Section
            title="Today"
            action={!doneToday && todays ? <LinkButton label="Other workout" onPress={() => show({ kind: 'start' })} /> : undefined}>
            {doneToday ? (
              <>
                <Text style={[st.big, { color: c.ink }]}>{`${doneToday.name} ✓`}</Text>
                <Mute>{workoutLine(doneToday)}</Mute>
                <Button label="View workout" onPress={() => show({ kind: 'workout', id: doneToday.id })} style={{ marginTop: space.md }} />
              </>
            ) : todays ? (
              <>
                <Text style={[st.big, { color: c.ink, marginBottom: space.xs }]}>{todays.name}</Text>
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
                <Button label="Start a workout" onPress={() => show({ kind: 'start' })} style={{ marginTop: space.md }} />
              </>
            )}
          </Section>
        )}

        <Section title="Routines" action={L.routines.length ? <LinkButton label="New" onPress={newRoutine} /> : undefined}>
          {L.routines.map((r, i) => {
            const days = L.schedule.map((id, j) => (id === r.id ? DAY_NAMES[j] : null)).filter(Boolean);
            return (
              <Pressable
                key={r.id}
                onPress={() => show({ kind: 'routine', id: r.id })}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}. Edit`}
                style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{r.name}</Text>
                  <Mute style={{ fontSize: 13 }}>
                    {r.items.length} exercises{days.length ? ` · ${days.join(', ')}` : ''}
                  </Mute>
                </View>
                <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
              </Pressable>
            );
          })}
          {L.routines.length ? (
            <View style={[st.foot, { borderTopColor: c.line }]}>
              <LinkButton label="Change plan" onPress={() => show({ kind: 'plan' })} />
              <LinkButton label="Exercises" onPress={() => show({ kind: 'library' })} color={c.mute} />
            </View>
          ) : (
            <View style={{ gap: space.sm }}>
              <Button label="Choose a plan" primary onPress={() => show({ kind: 'plan' })} />
              <Button label="Build my own" onPress={newRoutine} />
            </View>
          )}
        </Section>

        <Section title="History">
          {history.length ? null : <Mute>No workouts yet.</Mute>}
          {history.slice(0, 20).map((w, i) => (
            <Pressable
              key={w.id}
              onPress={() => show({ kind: 'workout', id: w.id })}
              accessibilityRole="button"
              style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{w.name}</Text>
                <Mute style={{ fontSize: 13 }}>{`${shortDayLabel(w.date)} · ${workoutLine(w)}`}</Mute>
              </View>
              <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
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
  big: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: space.md, marginTop: space.xs },
  planRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingVertical: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 4, flex: 1 },
  weekDot: { width: 28, height: 28, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
