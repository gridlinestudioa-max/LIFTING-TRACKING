import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  DAY_NAMES,
  activeWorkout,
  firstWorkout,
  liftDay,
  liftMedals,
  ORDINAL,
  applyTemplate,
  defaultIncrement,
  fmtW,
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
import { Header, Mute, Section } from '@/ui/components';
import { Button, LinkButton, Sheet } from '@/ui/food/kit';
import { ExercisePicker } from '@/ui/lifting/ExercisePicker';
import { LiftPlanPicker, type LiftChoice } from '@/ui/lifting/LiftPlanPicker';
import { LiftWeekStrip } from '@/ui/lifting/LiftWeekStrip';
import { useLibrary } from '@/ui/lifting/library';
import { RoutineSheet } from '@/ui/lifting/RoutineSheet';
import { WorkoutSheet } from '@/ui/lifting/WorkoutSheet';
import { MedalBadge } from '@/ui/Medal';
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
  const scheduled = L.schedule.filter(Boolean).length;

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
                  <Text style={[st.big, { color: c.ink, flexShrink: 1 }]}>{w.done ? `${w.name} ✓` : `${w.name} (in progress)`}</Text>
                  <MedalBadge medals={medals.get(w.id) ?? []} />
                </View>
                <Mute style={{ fontSize: 13 }}>
                  {w.done
                    ? workoutLine(w)
                    : `${w.exercises.reduce((t, x) => t + x.sets.filter((z) => z.done).length, 0)} of ${w.exercises.reduce((t, x) => t + x.sets.length, 0)} sets done`}
                </Mute>
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
              {day.routine.items.map((it) => {
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
              {selected === today && !active ? <Button label="Start workout" primary onPress={() => start(day.routine)} style={{ marginTop: space.md }} /> : null}
              {selected > today ? <Mute style={{ fontSize: 13, marginTop: space.sm }}>Weights are what you’d lift if you did it today. ↑ means it’s time to go up.</Mute> : null}
            </>
          ) : null}
          {!dayWorkouts.length && !day.routine ? <Text style={[st.big, { color: c.ink }]}>None</Text> : null}
          {!dayWorkouts.length && !day.routine ? <Mute>{selected === today ? 'Rest day. Record a workout above if you train anyway.' : 'Rest day.'}</Mute> : null}
        </Section>

        <Section title="Your plan" action={L.routines.length ? <LinkButton label="New routine" onPress={newRoutine} /> : undefined}>
          {L.routines.length ? (
            <>
              <Text style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>
                {scheduled
                  ? `${scheduled} ${scheduled === 1 ? 'workout' : 'workouts'} a week: ${L.schedule
                      .map((id, j) => (id ? `${DAY_NAMES[j]} ${L.routines.find((r) => r.id === id)?.name ?? ''}` : null))
                      .filter(Boolean)
                      .join(' · ')}.`
                  : 'No days scheduled yet. Open a routine to pick its days.'}
              </Text>
              <Mute style={{ fontSize: 13.5, lineHeight: 19, marginTop: space.sm }}>
                How it works: each exercise has a rep range, like 3 sets of 8–12. When you reach the top of the range on every set, the weight goes up next time. Until then, keep the weight and aim for one more rep.
              </Mute>
            </>
          ) : null}
          {L.routines.map((r, i) => {
            const days = L.schedule.map((id, j) => (id === r.id ? DAY_NAMES[j] : null)).filter(Boolean);
            return (
              <Pressable
                key={r.id}
                onPress={() => show({ kind: 'routine', id: r.id })}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}. Edit`}
                style={({ pressed }) => [st.row, { borderTopWidth: 1, borderTopColor: c.line, marginTop: i === 0 ? space.md : 0 }, { opacity: pressed ? 0.6 : 1 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{r.name}</Text>
                  <Mute style={{ fontSize: 13 }}>
                    {r.items.length} {r.items.length === 1 ? 'exercise' : 'exercises'}{days.length ? ` · ${days.join(', ')}` : ''}
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
              <Mute style={{ marginBottom: space.xs }}>Pick a ready-made plan (push/pull/legs, upper/lower, full body…) or build your own routines.</Mute>
              <Button label="Choose a plan" primary onPress={() => show({ kind: 'plan' })} />
              <Button label="Build my own" onPress={newRoutine} />
            </View>
          )}
        </Section>

        <Section title="History">
          {history.length ? null : <Mute>No workouts yet.</Mute>}
          {history.slice(0, shown).map((w, i) => (
            <Pressable
              key={w.id}
              onPress={() => show({ kind: 'workout', id: w.id })}
              accessibilityRole="button"
              style={({ pressed }) => [st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }, { opacity: pressed ? 0.6 : 1 }]}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700', flexShrink: 1 }}>{w.name}</Text>
                  <MedalBadge medals={medals.get(w.id) ?? []} />
                </View>
                <Mute style={{ fontSize: 13 }}>{`${shortDayLabel(w.date)} · ${workoutLine(w)}`}</Mute>
                {medals.get(w.id)?.length ? <Mute style={{ fontSize: 13, fontWeight: '600' }}>{medals.get(w.id)!.map((m) => `${ORDINAL[m.rank - 1]} ${m.label}`).join(' · ')}</Mute> : null}
              </View>
              <Text style={{ color: c.mute, fontSize: 22 }}>›</Text>
            </Pressable>
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
  big: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: space.md, marginTop: space.xs },
  planRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, paddingVertical: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
});
