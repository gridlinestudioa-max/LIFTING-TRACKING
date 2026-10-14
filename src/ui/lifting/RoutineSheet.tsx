import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DAY_NAMES, defaultIncrement, fmtW, nextTarget, type Routine, type RoutineItem } from '@/logic';

import { Field, Label, Mute } from '../components';
import { Button, LinkButton, Pill, Sheet } from '../food/kit';
import { useTracker } from '../store';
import { fonts, radius, space, useColors } from '../theme';
import { ExercisePicker } from './ExercisePicker';
import { useLibrary } from './library';

/** Edit a routine: name, exercises (sets, rep range, weight step), order, and which days it's on. */
export function RoutineSheet({ visible, id, onClose }: { visible: boolean; id: string; onClose: () => void }) {
  const c = useColors();
  const { state, update } = useTracker();
  const { byId } = useLibrary();
  const r = state.lifting.routines.find((x) => x.id === id);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (fn: (r: Routine) => Routine) =>
    update((s) => ({ ...s, lifting: { ...s.lifting, routines: s.lifting.routines.map((x) => (x.id === id ? fn(x) : x)) } }));
  const setItem = (i: number, patch: Partial<RoutineItem>) => save((r) => ({ ...r, items: r.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const move = (i: number, d: -1 | 1) =>
    save((r) => {
      const items = [...r.items];
      const j = i + d;
      if (j < 0 || j >= items.length) return r;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...r, items };
    });

  if (!r) {
    return (
      <Sheet visible={visible} title="Routine" onClose={onClose}>
        <Mute>This routine was deleted.</Mute>
      </Sheet>
    );
  }

  return (
    <Sheet visible={visible} title={adding ? 'Add exercise' : 'Edit routine'} onClose={onClose} left={adding ? <LinkButton label="Back" onPress={() => setAdding(false)} /> : undefined}>
      {adding ? (
        <ExercisePicker
          onPick={(e) => {
            save((r) => ({ ...r, items: [...r.items, { exId: e.id, sets: 3, repMin: 8, repMax: 12 }] }));
            setAdding(false);
          }}
        />
      ) : (
        <View>
          <Label>Name</Label>
          <Field value={r.name} onChangeText={(name) => save((r) => ({ ...r, name }))} placeholder="e.g. Push day" accessibilityLabel="Routine name" />

          <Label>Days</Label>
          <View style={st.wrap}>
            {DAY_NAMES.map((d, i) => {
              const on = state.lifting.schedule[i] === id;
              const other = !on && state.lifting.schedule[i] ? state.lifting.routines.find((x) => x.id === state.lifting.schedule[i])?.name : null;
              return (
                <Pill
                  key={d}
                  label={other ? `${d} (${other})` : d}
                  selected={on}
                  onPress={() =>
                    update((s) => ({ ...s, lifting: { ...s.lifting, schedule: s.lifting.schedule.map((x, j) => (j === i ? (on ? null : id) : x)) } }))
                  }
                />
              );
            })}
          </View>
          <Mute style={{ fontSize: 13, marginTop: 4 }}>One routine per day. Picking a day that has another routine replaces it.</Mute>

          <Text style={[st.h, { color: c.ink }]}>Exercises</Text>
          {r.items.length ? null : <Mute>No exercises yet.</Mute>}
          {r.items.map((it, i) => {
            const ex = byId(it.exId);
            const inc = it.inc ?? (ex ? defaultIncrement(ex) : 5);
            const t = nextTarget(it.exId, state.lifting.workouts, { ...it, inc });
            const u = ex?.unit === 'plates' ? 'plates' : 'lb';
            return (
              <View key={`${it.exId}-${i}`} style={[st.item, { borderColor: c.line, backgroundColor: c.card }]}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[st.exName, { color: c.ink }]}>{ex?.name ?? 'Exercise'}</Text>
                    <Mute style={{ fontSize: 13 }}>
                      {t.weight != null ? `Next time: ${fmtW(t.weight)} ${u}` : t.last ? 'Bodyweight' : 'Weight: set it in your first workout'}
                    </Mute>
                  </View>
                  <View style={{ flexDirection: 'row', gap: space.md }}>
                    <LinkButton label="↑" onPress={() => move(i, -1)} color={c.mute} />
                    <LinkButton label="↓" onPress={() => move(i, 1)} color={c.mute} />
                    <LinkButton label="Remove" onPress={() => save((r) => ({ ...r, items: r.items.filter((_, j) => j !== i) }))} color={c.mute} />
                  </View>
                </View>
                <View style={st.nums}>
                  <NumBox label="Sets" value={it.sets} min={1} onChange={(v) => setItem(i, { sets: v })} />
                  <NumBox label="Reps from" value={it.repMin} min={1} onChange={(v) => setItem(i, { repMin: v, repMax: Math.max(v, it.repMax) })} />
                  <NumBox label="to" value={it.repMax} min={1} onChange={(v) => setItem(i, { repMax: Math.max(v, it.repMin) })} />
                  <NumBox label={`Step (${u === 'plates' ? 'pl' : 'lb'})`} value={inc} min={0} decimal onChange={(v) => setItem(i, { inc: v })} />
                </View>
                {!t.last ? (
                  <View style={[st.nums, { marginTop: space.xs }]}>
                    <NumBox label={`Starting weight (${u})`} value={it.start ?? null} min={0} decimal onChange={(v) => setItem(i, { start: v })} wide />
                  </View>
                ) : null}
              </View>
            );
          })}
          <Button label="Add exercise" onPress={() => setAdding(true)} style={{ marginTop: space.md }} />
          <Mute style={{ fontSize: 13, marginTop: space.md }}>
            When you get the top of the rep range on every set, the weight goes up by the step. Three sessions under the bottom
            of the range drops it about 10%.
          </Mute>

          {confirmDelete ? (
            <View style={{ marginTop: space.xl, gap: space.sm }}>
              <Mute>Delete this routine? Workouts you logged with it stay in your history.</Mute>
              <Button
                label="Delete routine"
                danger
                onPress={() => {
                  update((s) => ({
                    ...s,
                    lifting: { ...s.lifting, routines: s.lifting.routines.filter((x) => x.id !== id), schedule: s.lifting.schedule.map((x) => (x === id ? null : x)) },
                  }));
                  onClose();
                }}
              />
              <Button label="Keep it" onPress={() => setConfirmDelete(false)} />
            </View>
          ) : (
            <Button label="Delete routine" danger onPress={() => setConfirmDelete(true)} style={{ marginTop: space.xl }} />
          )}
        </View>
      )}
    </Sheet>
  );
}

/** A small number field that saves valid numbers as you type. */
function NumBox({ label, value, min, decimal, wide, onChange }: { label: string; value: number | null; min: number; decimal?: boolean; wide?: boolean; onChange: (v: number) => void }) {
  const c = useColors();
  const [text, setText] = useState(value != null ? fmtW(value) : '');
  return (
    <View style={{ flex: wide ? 0 : 1, minWidth: wide ? 160 : 0, gap: 4 }}>
      <Text style={{ color: c.mute, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
        {label}
      </Text>
      <Field
        value={text}
        onChangeText={(t) => {
          setText(t);
          const v = decimal ? parseFloat(t) : parseInt(t, 10);
          if (Number.isFinite(v) && v >= min) onChange(v);
        }}
        keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
        accessibilityLabel={label}
        style={{ textAlign: 'center', fontWeight: '700', paddingHorizontal: 4, minHeight: 42 }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  h: { fontFamily: fonts.semi, fontSize: 22, lineHeight: 26, marginTop: space.xl, marginBottom: space.xs },
  item: { borderWidth: 1, borderRadius: radius.md, padding: space.md, marginTop: space.sm },
  exName: { fontSize: 16, fontWeight: '700' },
  nums: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
