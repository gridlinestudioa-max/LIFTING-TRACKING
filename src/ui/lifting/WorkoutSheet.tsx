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
import { Button, LinkButton, Sheet } from '../food/kit';
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
  const totalSets = w.exercises.reduce((t, x) => t + x.sets.length, 0);

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
          <View style={st.topline}>
            <Text style={{ color: c.mute, fontSize: 14, flex: 1 }}>{shortDayLabel(w.date)}{w.done ? ' · finished' : ''}</Text>
            <Text style={{ color: c.ink, fontSize: 14, fontWeight: '700', ...tabular }}>{`${doneSets}/${totalSets} sets`}</Text>
          </View>
          <View style={[st.progress, { backgroundColor: c.soft }]}>
            <View style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`, height: '100%', backgroundColor: c.ok, borderRadius: 3 }} />
          </View>
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
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.lg }}>
            <LinkButton label="+ Add exercise" onPress={() => setMode('add')} />
          </View>
          {!w.done ? (
            <Button
              label={doneSets ? 'Finish workout' : 'Check off sets as you go'}
              primary
              style={{ marginTop: space.lg, opacity: doneSets ? 1 : 0.5 }}
              onPress={() => {
                if (!doneSets) return;
                setSummary(progressionSummary(state.lifting, w));
                save((w) => ({ ...w, done: true, end: w.end ?? Date.now() }));
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
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: space.lg }}>
              <LinkButton label={w.done ? 'Delete workout' : 'Discard workout'} color={c.bad} onPress={() => setConfirmDiscard(true)} />
            </View>
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
  const u = x.unit === 'plates' ? 'pl' : 'lb';
  const allDone = x.sets.length > 0 && x.sets.every((s) => s.done);
  // A finished exercise folds to one line; tap it to open it again.
  const [open, setOpen] = useState(!allDone);
  const [wasDone, setWasDone] = useState(allDone);
  if (wasDone !== allDone) {
    setWasDone(allDone);
    setOpen(!allDone);
  }
  const [more, setMore] = useState(false);
  const lastText = last
    ? last.sets
        .filter((s) => s.done)
        .map((s) => (s.w ? `${fmtW(s.w)}×${s.reps}` : `${s.reps}`))
        .join(', ')
    : '';
  const best = x.sets.filter((s) => s.done && s.w).reduce<number | null>((m, s) => (m == null || s.w! > m ? s.w! : m), null);

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${x.name}, all ${x.sets.length} sets done. Show sets`}
        style={({ pressed }) => [st.doneCard, { backgroundColor: c.okbg, opacity: pressed ? 0.7 : 1 }]}>
        <View style={[st.tick, { backgroundColor: c.ok }]}>
          <StatusMark kind="done" color="#ffffff" size={14} />
        </View>
        <Text style={{ flex: 1, color: c.ink, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{x.name}</Text>
        <Text style={{ color: c.ok, fontSize: 14, fontWeight: '700', ...tabular }}>
          {`${x.sets.length} sets${best != null && !bodyweight ? ` · ${fmtW(best)} ${u}` : ''}`}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[st.card, { backgroundColor: c.card, borderColor: c.line }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Text style={[st.exName, { color: c.ink, flex: 1 }]} numberOfLines={1}>{x.name}</Text>
        <Text style={{ color: c.mute, fontSize: 13, fontWeight: '600', ...tabular }}>{`${x.repMin}–${x.repMax} reps`}</Text>
        <Pressable onPress={() => setMore(!more)} accessibilityRole="button" accessibilityLabel={`${x.name} options`} hitSlop={10} style={st.more}>
          <Text style={{ color: c.mute, fontSize: 18, fontWeight: '800', lineHeight: 18 }}>⋯</Text>
        </Pressable>
      </View>
      <Text style={{ color: c.mute, fontSize: 12.5, marginTop: 1 }} numberOfLines={more ? undefined : 1}>
        {[note, lastText ? `Last: ${lastText}` : null].filter(Boolean).join(' · ')}
      </Text>
      {more ? (
        <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.sm }}>
          <LinkButton label="+ Set" onPress={onAddSet} />
          {x.sets.length > 1 ? <LinkButton label="− Set" onPress={onRemoveSet} /> : null}
          <LinkButton label="Remove exercise" color={c.bad} onPress={onRemove} />
        </View>
      ) : null}
      <View style={{ marginTop: space.xs }}>
        {x.sets.map((s, k) => (
          <SetRow key={k} n={k + 1} s={s} unit={bodyweight ? `+${u}` : u} repMin={x.repMin} repHint={`${x.repMin}–${x.repMax}`} onChange={(ns) => onSet(k, ns)} />
        ))}
      </View>
    </View>
  );
}

/**
 * One set. Open: weight, reps and a check box. Once checked it folds to a slim green line; tap it to edit.
 * Number fields keep their own text so "2." can be typed. Checking a set with no reps fills in the bottom
 * of the range (never enough to raise the weight).
 */
function SetRow({ n, s, unit, repMin, repHint, onChange }: { n: number; s: WSet; unit: string; repMin: number; repHint: string; onChange: (s: WSet) => void }) {
  const c = useColors();
  const [wt, setWt] = useState(s.w != null ? fmtW(s.w) : '');
  const [rt, setRt] = useState(s.reps != null ? String(s.reps) : '');
  const [prev, setPrev] = useState(s);
  const [editing, setEditing] = useState(false);
  if (prev !== s) {
    setPrev(s);
    if ((s.w != null ? fmtW(s.w) : '') !== wt && parseFloat(wt) !== s.w) setWt(s.w != null ? fmtW(s.w) : '');
    if ((s.reps != null ? String(s.reps) : '') !== rt) setRt(s.reps != null ? String(s.reps) : '');
    if (prev.done !== s.done) setEditing(false);
  }
  const parse = (t: string) => {
    const v = parseFloat(t);
    return t.trim() === '' || !Number.isFinite(v) || v < 0 ? null : v;
  };
  const toggle = () => onChange({ ...s, done: !s.done, reps: !s.done && s.reps == null ? repMin : s.reps });

  if (s.done && !editing) {
    return (
      <Pressable
        onPress={() => setEditing(true)}
        accessibilityRole="button"
        accessibilityLabel={`Set ${n} done: ${s.w != null ? `${fmtW(s.w)} ${unit}, ` : ''}${s.reps ?? 0} reps. Edit`}
        style={({ pressed }) => [st.doneSet, { backgroundColor: c.okbg, opacity: pressed ? 0.7 : 1 }]}>
        <View style={[st.tickSm, { backgroundColor: c.ok }]}>
          <StatusMark kind="done" color="#ffffff" size={12} />
        </View>
        <Text style={{ color: c.ok, fontSize: 14, fontWeight: '700', width: 46 }}>{`Set ${n}`}</Text>
        <Text style={{ flex: 1, color: c.ink, fontSize: 15, fontWeight: '600', ...tabular }}>
          {s.w != null ? `${fmtW(s.w)} ${unit} × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={st.setRow}>
      <Text style={[st.setNo, { color: c.mute }]}>{n}</Text>
      <View style={st.numWrap}>
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
        <Text style={[st.unit, { color: c.mute }]}>{unit}</Text>
      </View>
      <Text style={{ color: c.mute, fontSize: 15 }}>×</Text>
      <View style={st.numWrap}>
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
        <Text style={[st.unit, { color: c.mute }]}>reps</Text>
      </View>
      <Pressable
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: s.done }}
        accessibilityLabel={`Set ${n} done`}
        hitSlop={8}
        style={[st.check, { borderColor: s.done ? c.ok : c.line, backgroundColor: s.done ? c.ok : 'transparent' }]}>
        {s.done ? <StatusMark kind="done" color="#ffffff" size={18} /> : null}
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  big: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36 },
  sumRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  topline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  progress: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 6, marginBottom: space.xs },
  card: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingTop: space.sm + 2, paddingBottom: space.sm, marginTop: space.sm },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2, marginTop: space.sm },
  exName: { fontFamily: fonts.semi, fontSize: 19, lineHeight: 23 },
  more: { width: 28, height: 24, alignItems: 'center', justifyContent: 'center' },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 3 },
  doneSet: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 6, marginVertical: 2 },
  setNo: { width: 18, textAlign: 'center', fontSize: 14, fontWeight: '700' },
  numWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  num: { flex: 1, minWidth: 0, textAlign: 'center', fontWeight: '700', paddingHorizontal: 4, paddingVertical: 6, minHeight: 38 },
  unit: { fontSize: 12, fontWeight: '600', minWidth: 22 },
  check: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tickSm: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
