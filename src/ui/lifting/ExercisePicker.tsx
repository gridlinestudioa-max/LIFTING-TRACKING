import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { EQUIPMENT, MUSCLE_GROUPS, newId, searchExercises, type Exercise, type Unit } from '@/logic';

import { Field, Label, Mute } from '../components';
import { Button, LinkButton, Pill } from '../food/kit';
import { MultiSelect, Select } from '../Select';
import { useTracker } from '../store';
import { fonts, radius, space, useColors } from '../theme';
import { useLibrary } from './library';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One line about an exercise: equipment and main muscles. */
export function exerciseMeta(e: Exercise): string {
  return [cap(e.equipment), e.primary.map(cap).join(', ')].filter(Boolean).join(' · ');
}

/**
 * Search the library and your own exercises; filter by muscle group; open one for details; or create one.
 * `onPick` set = choosing an exercise (for a routine or workout); otherwise just browsing.
 */
export function ExercisePicker({ onPick, pickLabel = 'Add' }: { onPick?: (e: Exercise) => void; pickLabel?: string }) {
  const c = useColors();
  const { all, loading } = useLibrary();
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const muscles = group ? MUSCLE_GROUPS.find((g) => g.id === group)!.muscles : null;
  const results = useMemo(() => searchExercises(all, q, muscles, 60), [all, q, muscles]);

  if (creating) return <CreateExercise initialName={q} onDone={(e) => (setCreating(false), e && (onPick ? onPick(e) : setDetail(e)))} />;
  if (detail) {
    return (
      <View>
        <LinkButton label="Back to exercises" onPress={() => setDetail(null)} />
        <Text style={[st.name, { color: c.ink, marginTop: space.md }]}>{detail.name}</Text>
        <Mute>{exerciseMeta(detail)}{detail.level ? ` · ${cap(detail.level)}` : ''}</Mute>
        {detail.secondary.length ? <Mute style={{ fontSize: 13 }}>Also works: {detail.secondary.map(cap).join(', ')}</Mute> : null}
        {detail.image ? (
          <Image
            source={{ uri: detail.image }}
            accessibilityLabel={`${detail.name} demonstration`}
            style={[st.image, { backgroundColor: c.soft }]}
            resizeMode="contain"
          />
        ) : null}
        {detail.instructions?.length ? (
          <View style={{ marginTop: space.md, gap: space.sm }}>
            {detail.instructions.map((s, i) => (
              <Text key={i} style={{ color: c.ink, fontSize: 15, lineHeight: 21 }}>
                <Text style={{ fontWeight: '700' }}>{i + 1}. </Text>
                {s}
              </Text>
            ))}
          </View>
        ) : null}
        {onPick ? <Button label={pickLabel} primary onPress={() => onPick(detail)} style={{ marginTop: space.lg }} /> : null}
      </View>
    );
  }

  return (
    <View>
      <Field value={q} onChangeText={setQ} placeholder="Search 700+ exercises" autoCorrect={false} accessibilityLabel="Search exercises" />
      <View style={{ marginTop: space.sm }}>
        <Select
          label="Muscle group"
          value={group ?? ''}
          options={[{ value: '', label: 'All muscle groups' }, ...MUSCLE_GROUPS.map((g) => ({ value: g.id, label: g.label }))]}
          onChange={(v) => setGroup(v || null)}
        />
      </View>
      <View style={{ flexDirection: 'row', marginTop: space.md }}>
        <LinkButton label="Create your own exercise" onPress={() => setCreating(true)} />
      </View>
      {loading ? <Mute style={{ marginTop: space.md }}>Loading exercises…</Mute> : null}
      <View style={{ marginTop: space.sm }}>
        {results.map((e, i) => (
          <View key={e.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: c.line }]}>
            <Pressable onPress={() => setDetail(e)} accessibilityRole="button" accessibilityLabel={`${e.name}, details`} style={{ flex: 1 }}>
              {({ pressed }) => (
                <View style={{ opacity: pressed ? 0.6 : 1 }}>
                  <Text style={{ color: c.ink, fontSize: 16, fontWeight: '600' }}>{e.name}</Text>
                  <Text style={{ color: c.mute, fontSize: 13 }}>
                    {exerciseMeta(e)}
                    {e.custom ? ' · Yours' : ''}
                  </Text>
                </View>
              )}
            </Pressable>
            {onPick ? <Pill label={pickLabel} selected={false} onPress={() => onPick(e)} /> : null}
          </View>
        ))}
        {!loading && !results.length ? <Mute style={{ marginTop: space.md }}>{`No exercises match “${q.trim()}”.`}</Mute> : null}
      </View>
    </View>
  );
}

/** Make your own exercise. Saved with your data. */
function CreateExercise({ initialName, onDone }: { initialName: string; onDone: (e: Exercise | null) => void }) {
  const c = useColors();
  const { update } = useTracker();
  const [name, setName] = useState(initialName);
  const [equipment, setEquipment] = useState('machine');
  const [primary, setPrimary] = useState<string[]>([]);
  const [unit, setUnit] = useState<Unit>('lb');
  const [err, setErr] = useState<string | null>(null);
  const muscles = MUSCLE_GROUPS.flatMap((g) => g.muscles);
  return (
    <View>
      <LinkButton label="Cancel" onPress={() => onDone(null)} />
      <Text style={[st.name, { color: c.ink, marginTop: space.md }]}>New exercise</Text>
      <Label>Name</Label>
      <Field value={name} onChangeText={setName} placeholder="e.g. Hotel gym chest press" accessibilityLabel="Exercise name" />
      <Label>Equipment</Label>
      <Select label="Equipment" value={equipment} options={EQUIPMENT.map((e) => ({ value: e, label: cap(e) }))} onChange={setEquipment} />
      <Label>Main muscles</Label>
      <MultiSelect label="Main muscles" values={primary} options={muscles.map((m) => ({ value: m, label: cap(m) }))} onChange={setPrimary} placeholder="Choose" />
      <Label>Weight is counted in</Label>
      <Select<Unit>
        label="Weight is counted in"
        value={unit}
        options={[
          { value: 'lb', label: 'Pounds' },
          { value: 'plates', label: 'Plates', hint: 'For machines with numbered plates or pins.' },
        ]}
        onChange={setUnit}
      />
      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button
        label="Save exercise"
        primary
        style={{ marginTop: space.lg }}
        onPress={() => {
          if (!name.trim()) return setErr('Give it a name.');
          if (!primary.length) return setErr('Pick at least one muscle (used for the weight step and filters).');
          const e: Exercise = { id: newId('ex'), name: name.trim(), equipment, primary, secondary: [], custom: true };
          if (unit === 'plates') e.unit = 'plates';
          update((s) => ({ ...s, lifting: { ...s.lifting, exercises: [...s.lifting.exercises, e] } }));
          onDone(e);
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32 },
  image: { width: '100%', aspectRatio: 1.4, borderRadius: radius.md, marginTop: space.md },
});
