import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  defaultItem,
  fmtW,
  isBodyweight,
  nextTarget,
  progressionSummary,
  shortDayLabel,
  targetNote,
  workoutExercise,
  type Workout,
  type WorkoutExercise,
  type WSet,
} from '@/logic';

import { Field, Mute } from '../components';
import { Button, LinkButton, Pill, Sheet } from '../food/kit';
import { StatusMark } from '../marks';
import { useTracker } from '../store';
import { fonts, radius, space, tabular, useColors } from '../theme';
import { ExercisePicker } from './ExercisePicker';
import { useLibrary } from './library';

type Mode = 'log' | 'add' | 'summary';

/** Log a workout (in progress or finished). Every change saves right away. */
export function WorkoutSheet({ visible, id, onClose }: { visible: boolean; id: string; onClose: () => void }) {
  const c = useColors();
  const { state, update } = useTracker();
  const { byId } = useLibrary();
  const w = state.lifting.workouts.find((x) => x.id === id);
  const [mode, setMode] = useState<Mode>('log');
  const [summary, setSummary] = useState<ReturnType<typeof progressionSummary>>([]);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const save = (fn: (w: Workout) => Workout) =>
    update((s) => ({ ...s, lifting: { ...s.lifting, workouts: s.lifting.workouts.map((x) => (x.id === id ? fn(x) : x)) } }));
  const setEx = (i: number, fn: (x: WorkoutExercise) => WorkoutExercise) => save((w) => ({ ...w, exercises: w.exercises.map((x, j) => (j === i ? fn(x) : x)) }));

  if (!w) {
    return (
      <Sheet visible={visible} title="Workout" onClose={onClose}>
        <Mute>This workout was deleted.</Mute>
      </Sheet>
    );
  }

  const others = state.lifting.workouts.filter((x) => x.id !== id);
  const doneSets = w.exercises.reduce((t, x) => t + x.sets.filter((s) => s.done).length, 0);

  return (
    <Sheet
      visible={visible}
      title={mode === 'add' ? 'Add exercise' : mode === 'summary' ? 'Nice work' : w.name}
      onClose={onClose}
      left={mode === 'add' ? <LinkButton label="Back" onPress={() => setMode('log')} /> : undefined}>
      {mode === 'add' ? (
        <ExercisePicker
          onPick={(e) => {
            const it = defaultItem(state.lifting, e.id);
            save((w) => ({ ...w, exercises: [...w.exercises, workoutExercise({ ...state.lifting, workouts: others }, it, byId)] }));
            setMode('log');
          }}
        />
      ) : mode === 'summary' ? (
        <View>
          <Text style={[st.big, { color: c.ink }]}>{w.name} done</Text>
          {summary.map((s, i) => (
            <View key={i} style={[st.sumRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.ink, fontSize: 16, fontWeight: '700' }}>{s.name}</Text>
                <Text style={{ color: c.mute, fontSize: 14 }}>{s.note}</Text>
              </View>
              {s.to != null ? (
                <Text style={{ color: s.from != null && s.to > s.from ? c.ok : s.from != null && s.to < s.from ? c.warn : c.ink, fontSize: 17, fontWeight: '800', ...tabular }}>
                  {s.from != null && s.to !== s.from ? `${fmtW(s.from)} → ` : ''}
                  {fmtW(s.to)} {s.unit === 'plates' ? 'pl' : 'lb'}
                </Text>
              ) : null}
            </View>
          ))}
          <Button label="Close" primary onPress={onClose} style={{ marginTop: space.xl }} />
        </View>
      ) : (
        <View>
          <Text style={{ color: c.mute, fontSize: 14 }}>{shortDayLabel(w.date)}{w.done ? ' · finished' : ''}</Text>
          {w.exercises.map((x, i) => {
            const ex = byId(x.exId);
            const bw = ex ? isBodyweight(ex) : false;
            const t = nextTarget(x.exId, others, { sets: x.sets.length, repMin: x.repMin, repMax: x.repMax, inc: x.inc });
            return (
              <ExerciseCard
                key={`${x.exId}-${i}`}
                x={x}
                note={targetNote(t, x.unit, bw)}
                last={t.last}
                bodyweight={bw}
                onSet={(k, set) => setEx(i, (x) => ({ ...x, sets: x.sets.map((s, j) => (j === k ? set : s)) }))}
                onAddSet={() => setEx(i, (x) => ({ ...x, sets: [...x.sets, { ...(x.sets[x.sets.length - 1] ?? { w: null }), reps: null, done: false }] }))}
                onRemoveSet={() => setEx(i, (x) => ({ ...x, sets: x.sets.slice(0, -1) }))}
                onRemove={() => save((w) => ({ ...w, exercises: w.exercises.filter((_, j) => j !== i) }))}
              />
            );
          })}
          <Button label="Add exercise" onPress={() => setMode('add')} style={{ marginTop: space.lg }} />
          {!w.done ? (
            <Button
              label={doneSets ? 'Finish workout' : 'Check off sets as you go'}
              primary
              style={{ marginTop: space.md, opacity: doneSets ? 1 : 0.5 }}
              onPress={() => {
                if (!doneSets) return;
                setSummary(progressionSummary(state.lifting, w));
                save((w) => ({ ...w, done: true }));
                setMode('summary');
              }}
            />
          ) : null}
          {confirmDiscard ? (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              <Mute>{w.done ? 'Delete this workout from your history?' : 'Throw away this workout?'}</Mute>
              <Button
                label={w.done ? 'Delete workout' : 'Discard workout'}
                danger
                onPress={() => {
                  update((s) => ({ ...s, lifting: { ...s.lifting, workouts: s.lifting.workouts.filter((x) => x.id !== id) } }));
                  onClose();
                }}
              />
              <Button label="Keep it" onPress={() => setConfirmDiscard(false)} />
            </View>
          ) : (
            <Button label={w.done ? 'Delete workout' : 'Discard workout'} danger onPress={() => setConfirmDiscard(true)} style={{ marginTop: space.md }} />
          )}
        </View>
      )}
    </Sheet>
  );
}

function ExerciseCard({
  x,
  note,
  last,
  bodyweight,
  onSet,
  onAddSet,
  onRemoveSet,
  onRemove,
}: {
  x: WorkoutExercise;
  note: string;
  last?: { date: string; sets: WSet[] };
  bodyweight: boolean;
  onSet: (k: number, s: WSet) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onRemove: () => void;
}) {
  const c = useColors();
  const u = x.unit === 'plates' ? 'plates' : 'lb';
  const lastText = last
    ? last.sets
        .filter((s) => s.done)
        .map((s) => (s.w ? `${fmtW(s.w)}×${s.reps}` : `${s.reps}`))
        .join(', ')
    : '';
  return (
    <View style={[st.card, { borderColor: c.line, backgroundColor: c.card }]}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={[st.exName, { color: c.ink }]}>{x.name}</Text>
          <Text style={{ color: c.ink, fontSize: 14, fontWeight: '600', ...tabular }}>
            {x.sets.length} × {x.repMin}–{x.repMax}
            {x.sets[0]?.w != null && !bodyweight ? ` @ ${fmtW(x.sets[0].w!)} ${u}` : ''}
          </Text>
        </View>
        <LinkButton label="Remove" onPress={onRemove} color={c.mute} />
      </View>
      <Mute style={{ fontSize: 13, marginTop: 2 }}>{note}</Mute>
      {lastText ? <Mute style={{ fontSize: 13 }}>Last time: {lastText}</Mute> : null}

      <View style={[st.setHead]}>
        <Text style={[st.setCol, st.setNo, { color: c.mute }]}>Set</Text>
        <Text style={[st.setCol, { color: c.mute }]}>{bodyweight ? 'Added weight' : u === 'plates' ? 'Plates' : 'Weight (lb)'}</Text>
        <Text style={[st.setCol, { color: c.mute }]}>Reps</Text>
        <View style={{ width: 40 }} />
      </View>
      {x.sets.map((s, k) => (
        <SetRow key={k} n={k + 1} s={s} repMin={x.repMin} repHint={`${x.repMin}–${x.repMax}`} onChange={(ns) => onSet(k, ns)} />
      ))}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Pill label="+ Set" selected={false} onPress={onAddSet} />
        {x.sets.length > 1 ? <Pill label="− Set" selected={false} onPress={onRemoveSet} /> : null}
      </View>
    </View>
  );
}

/** One set: weight, reps, done. Number fields keep their own text so "2." can be typed. */
/** Checking a set with no reps typed fills in the bottom of the range (never enough to raise the weight). */
function SetRow({ n, s, repMin, repHint, onChange }: { n: number; s: WSet; repMin: number; repHint: string; onChange: (s: WSet) => void }) {
  const c = useColors();
  const [wt, setWt] = useState(s.w != null ? fmtW(s.w) : '');
  const [rt, setRt] = useState(s.reps != null ? String(s.reps) : '');
  const [prev, setPrev] = useState(s);
  if (prev !== s) {
    setPrev(s);
    if ((s.w != null ? fmtW(s.w) : '') !== wt && parseFloat(wt) !== s.w) setWt(s.w != null ? fmtW(s.w) : '');
    if ((s.reps != null ? String(s.reps) : '') !== rt) setRt(s.reps != null ? String(s.reps) : '');
  }
  const parse = (t: string) => {
    const v = parseFloat(t);
    return t.trim() === '' || !Number.isFinite(v) || v < 0 ? null : v;
  };
  return (
    <View style={[st.setRow, s.done && { backgroundColor: c.okbg }]}>
      <Text style={[st.setCol, st.setNo, { color: c.ink, fontWeight: '700' }]}>{n}</Text>
      <View style={st.setCol}>
        <Field
          value={wt}
          onChangeText={(t) => {
            setWt(t);
            onChange({ ...s, w: parse(t) });
          }}
          keyboardType="decimal-pad"
          placeholder="–"
          accessibilityLabel={`Set ${n} weight`}
          style={st.num}
        />
      </View>
      <View style={st.setCol}>
        <Field
          value={rt}
          onChangeText={(t) => {
            setRt(t);
            const r = parse(t);
            onChange({ ...s, reps: r == null ? null : Math.round(r) });
          }}
          keyboardType="number-pad"
          placeholder={repHint}
          accessibilityLabel={`Set ${n} reps`}
          style={st.num}
        />
      </View>
      <Pressable
        onPress={() => onChange({ ...s, done: !s.done, reps: !s.done && s.reps == null ? repMin : s.reps })}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: s.done }}
        accessibilityLabel={`Set ${n} done`}
        hitSlop={8}
        style={[st.check, { borderColor: s.done ? c.ok : c.mute, backgroundColor: s.done ? c.ok : 'transparent' }]}>
        {s.done ? <StatusMark kind="done" color={c.onAccent} size={18} /> : null}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  big: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginTop: space.md },
  exName: { fontFamily: fonts.semi, fontSize: 21, lineHeight: 25 },
  setHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md, paddingHorizontal: 4 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4, paddingHorizontal: 4, borderRadius: radius.sm, marginTop: 2 },
  setCol: { flex: 1, fontSize: 12.5, fontWeight: '600' },
  setNo: { flex: 0, width: 32, textAlign: 'center' },
  num: { textAlign: 'center', fontWeight: '700', paddingHorizontal: 4, minHeight: 42 },
  check: { width: 40, height: 40, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
