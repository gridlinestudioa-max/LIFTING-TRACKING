import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ACTIVITY, GOALS, fmt, profileError, type Activity, type Goal, type Profile, type Sex } from '@/logic';

import { Field, Mute } from '../components';
import { space, useColors } from '../theme';
import { Button, Pill } from './kit';

/** Body stats. Units are the app's: pounds, feet and inches. */
export function ProfileForm({ initial, onSave, onCancel }: { initial: Profile | null; onSave: (p: Profile) => void; onCancel?: () => void }) {
  const c = useColors();
  const [sex, setSex] = useState<Sex | undefined>(initial?.sex);
  const [age, setAge] = useState(initial ? String(initial.age) : '');
  const [ft, setFt] = useState(initial ? String(Math.floor(initial.heightIn / 12)) : '');
  const [inch, setInch] = useState(initial ? fmt(Math.round((initial.heightIn % 12) * 10) / 10) : '');
  const [lb, setLb] = useState(initial ? fmt(initial.weightLb) : '');
  const [activity, setActivity] = useState<Activity | undefined>(initial?.activity);
  const [goal, setGoal] = useState<Goal | undefined>(initial?.goal);
  const [err, setErr] = useState<string | null>(null);

  const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
  const draft: Partial<Profile> = {
    sex,
    age: num(age),
    heightIn: num(ft) * 12 + (inch.trim() === '' ? 0 : Number(inch)),
    weightLb: num(lb),
    activity,
    goal,
  };

  return (
    <View>
      <Text style={[st.lbl, { color: c.mute }]}>Sex</Text>
      <View style={st.wrap}>
        <Pill label="Male" selected={sex === 'male'} onPress={() => setSex('male')} />
        <Pill label="Female" selected={sex === 'female'} onPress={() => setSex('female')} />
      </View>

      <View style={[st.line, { marginTop: space.md }]}>
        <Num label="Age" unit="years" value={age} onChange={setAge} />
        <Num label="Weight" unit="lb" value={lb} onChange={setLb} />
      </View>
      <View style={[st.line, { marginTop: space.md }]}>
        <Num label="Height" unit="ft" value={ft} onChange={setFt} />
        <Num label=" " unit="in" value={inch} onChange={setInch} a11y="Height, inches" />
      </View>

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>How active are you?</Text>
      <View style={st.wrap}>
        {ACTIVITY.map((a) => (
          <Pill key={a.id} label={a.label} selected={activity === a.id} onPress={() => setActivity(a.id)} />
        ))}
      </View>
      {activity ? <Mute style={{ marginTop: space.xs }}>{ACTIVITY.find((a) => a.id === activity)!.blurb}</Mute> : null}

      <Text style={[st.lbl, { color: c.mute, marginTop: space.lg }]}>Goal</Text>
      <View style={st.wrap}>
        {GOALS.map((g) => (
          <Pill key={g.id} label={g.label} selected={goal === g.id} onPress={() => setGoal(g.id)} />
        ))}
      </View>
      {goal ? <Mute style={{ marginTop: space.xs }}>{GOALS.find((g) => g.id === goal)!.blurb}</Mute> : null}

      {err ? <Text style={{ color: c.bad, fontWeight: '700', marginTop: space.md }}>{err}</Text> : null}
      <Button
        label="Save and suggest targets"
        primary
        style={{ marginTop: space.lg }}
        onPress={() => {
          const e = profileError(draft);
          if (e) return setErr(e);
          setErr(null);
          onSave(draft as Profile);
        }}
      />
      {onCancel ? <Button label="Cancel" onPress={onCancel} style={{ marginTop: space.sm }} /> : null}
    </View>
  );
}

function Num({ label, unit, value, onChange, a11y }: { label: string; unit: string; value: string; onChange: (v: string) => void; a11y?: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Text style={[st.lbl, { color: c.mute }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Field
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          accessibilityLabel={a11y ?? `${label}, ${unit}`}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Text style={{ color: c.mute, fontSize: 14, width: 40 }}>{unit}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  lbl: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  line: { flexDirection: 'row', gap: space.md },
});
